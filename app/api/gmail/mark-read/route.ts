import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-user";
import { getGmailClientFromDb } from "@/lib/gmail/oauth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Marque un message importé Gmail comme lu côté Google et met à jour readAt en base.
 * Respecte le réglage gmailMarkReadOnOpen (vérifie aussi côté serveur).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const messageId = Number.parseInt(String((body as { messageId?: unknown }).messageId), 10);
  if (!Number.isFinite(messageId) || messageId < 1) {
    return NextResponse.json({ error: "messageId invalide." }, { status: 400 });
  }

  const settings = await prisma.googleOAuthSettings.findUnique({
    where: { id: 1 },
    select: { gmailMarkReadOnOpen: true },
  });

  if (settings?.gmailMarkReadOnOpen !== true) {
    return NextResponse.json({ skipped: true, reason: "disabled" });
  }

  const msg = await prisma.inboundMessage.findFirst({
    where: {
      id: messageId,
      inboundAddress: { isActive: true },
    },
    select: {
      id: true,
      gmailMessageId: true,
      readAt: true,
    },
  });

  if (!msg) {
    return NextResponse.json({ error: "Message introuvable." }, { status: 404 });
  }

  if (!msg.gmailMessageId?.trim()) {
    return NextResponse.json({ skipped: true, reason: "not_gmail" });
  }

  if (msg.readAt) {
    return NextResponse.json({ skipped: true, reason: "already_read" });
  }

  const gmail = await getGmailClientFromDb();
  if (!gmail) {
    return NextResponse.json(
      { error: "Gmail non connecte." },
      { status: 503 }
    );
  }

  try {
    await gmail.users.messages.modify({
      userId: "me",
      id: msg.gmailMessageId.trim(),
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
  } catch (e) {
    const msgErr = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Gmail: ${msgErr.slice(0, 200)}` },
      { status: 502 }
    );
  }

  await prisma.inboundMessage.update({
    where: { id: messageId },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
