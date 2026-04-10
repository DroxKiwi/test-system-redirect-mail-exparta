import type { Prisma } from "@prisma/client";
import { ActionLogStatus, RuleActionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BoiteListMessage = {
  id: number;
  receivedAt: Date;
  mailFrom: string;
  subject: string | null;
  textBody: string | null;
  rcptTo: Prisma.JsonValue;
  inboundAddress: { localPart: string; domain: string };
  attachments: { id: number }[];
};

const boiteListMessageSelect = {
  id: true,
  receivedAt: true,
  mailFrom: true,
  subject: true,
  textBody: true,
  rcptTo: true,
  inboundAddress: {
    select: { localPart: true, domain: true },
  },
  attachments: { select: { id: true }, take: 1 },
} as unknown as Prisma.InboundMessageSelect;

export async function loadBoiteMessages(
  userId: number,
  archived: boolean,
  take = 150,
): Promise<BoiteListMessage[]> {
  return (await prisma.inboundMessage.findMany({
    where: {
      archived,
      inboundAddress: { userId },
    },
    orderBy: { receivedAt: "desc" },
    take,
    select: boiteListMessageSelect,
  })) as unknown as BoiteListMessage[];
}

/** Messages pour lesquels une action FORWARD a reussi (regle ou raccourci manuel). */
export async function loadTransferredMessages(
  userId: number,
  take = 150,
): Promise<BoiteListMessage[]> {
  return (await prisma.inboundMessage.findMany({
    where: {
      inboundAddress: { userId },
      actionLogs: {
        some: {
          status: ActionLogStatus.SENT,
          OR: [
            { action: { type: RuleActionType.FORWARD } },
            {
              actionId: null,
              detail: { path: ["type"], equals: "FORWARD" },
            },
          ],
        },
      },
    },
    orderBy: { receivedAt: "desc" },
    take,
    select: boiteListMessageSelect,
  })) as unknown as BoiteListMessage[];
}
