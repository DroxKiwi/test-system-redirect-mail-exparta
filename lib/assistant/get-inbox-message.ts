import { prisma } from "@/lib/db/prisma";
import { boiteInboxWhere } from "@/lib/boite/boite-messages";

const MAX_BODY_CHARS = 12_000;

export type InboxMessageForAgent = {
  id: number;
  subject: string | null;
  mailFrom: string;
  receivedAt: string;
  /** Corps texte ; null si absent (mail HTML seul). */
  textBody: string | null;
  path: string;
};

export async function getInboxMessageForAgent(
  id: number,
): Promise<{ ok: true; message: InboxMessageForAgent } | { ok: false; error: string }> {
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "Invalid message id." };
  }

  const row = await prisma.inboundMessage.findFirst({
    where: {
      AND: [boiteInboxWhere(), { id }],
    },
    select: {
      id: true,
      subject: true,
      mailFrom: true,
      receivedAt: true,
      textBody: true,
    },
  });

  if (!row) {
    return {
      ok: false,
      error:
        "Message not found in inbox (archived, already handled, or wrong id).",
    };
  }

  let text = row.textBody ?? "";
  if (text.length > MAX_BODY_CHARS) {
    text = `${text.slice(0, MAX_BODY_CHARS)}\n\n[… truncated …]`;
  }

  return {
    ok: true,
    message: {
      id: row.id,
      subject: row.subject,
      mailFrom: row.mailFrom,
      receivedAt: row.receivedAt.toISOString(),
      textBody: text.length > 0 ? text : null,
      path: `/boite/${row.id}`,
    },
  };
}
