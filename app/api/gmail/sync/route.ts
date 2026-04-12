import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-user";
import { syncGmailToBoite } from "@/lib/gmail/sync-inbox";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Synchronise les e-mails Gmail non lus (boîte de réception) vers la base locale.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await syncGmailToBoite();
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    imported: result.imported,
    skippedAlready: result.skippedAlready,
    fetchErrors: result.fetchErrors,
  });
}
