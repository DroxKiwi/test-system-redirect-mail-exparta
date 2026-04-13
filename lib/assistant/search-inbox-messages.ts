import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { boiteInboxWhere } from "@/lib/boite/boite-messages";

export type InboxSearchMatch = {
  id: number;
  subject: string | null;
  mailFrom: string;
  receivedAt: string;
  snippet: string;
  path: string;
};

export async function searchInboxMessagesForAgent(input: {
  textContains?: string;
  fromContains?: string;
  subjectContains?: string;
  limit?: number;
}): Promise<{ matches: InboxSearchMatch[]; note?: string }> {
  const t = input.textContains?.trim();
  const f = input.fromContains?.trim();
  const s = input.subjectContains?.trim();
  if (!t && !f && !s) {
    return {
      matches: [],
      note: "Provide at least one filter: body text, sender, or subject.",
    };
  }

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
  const clauses: Prisma.InboundMessageWhereInput[] = [boiteInboxWhere()];

  if (t) {
    clauses.push({
      OR: [
        { textBody: { contains: t, mode: "insensitive" } },
        { subject: { contains: t, mode: "insensitive" } },
      ],
    });
  }
  if (f) {
    clauses.push({
      mailFrom: { contains: f, mode: "insensitive" },
    });
  }
  if (s) {
    clauses.push({
      subject: { contains: s, mode: "insensitive" },
    });
  }

  const rows = await prisma.inboundMessage.findMany({
    where: { AND: clauses },
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: {
      id: true,
      subject: true,
      mailFrom: true,
      receivedAt: true,
      textBody: true,
    },
  });

  return {
    matches: rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      mailFrom: r.mailFrom,
      receivedAt: r.receivedAt.toISOString(),
      snippet: (r.textBody ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
      path: `/boite/${r.id}`,
    })),
  };
}
