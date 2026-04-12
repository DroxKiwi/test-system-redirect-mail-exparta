import type { Prisma } from "@prisma/client";
import { ActionLogStatus, RuleActionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BoiteListMessage = {
  id: number;
  receivedAt: Date;
  /** Non null = lu dans l'interface (ex. ouverture + option Gmail). */
  readAt: Date | null;
  mailFrom: string;
  subject: string | null;
  textBody: string | null;
  rcptTo: Prisma.JsonValue;
  inboundAddress: { localPart: string; domain: string };
  attachments: { id: number }[];
  /** Présent si le message a été importé depuis l’API Gmail (identifiant côté Google). */
  gmailMessageId: string | null;
};

/** Transfert réussi : règle FORWARD ou raccourci (journal SENT + type FORWARD). */
const whereHasSuccessfulForward: Prisma.InboundMessageWhereInput = {
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
};

const boiteListMessageSelect = {
  id: true,
  receivedAt: true,
  readAt: true,
  mailFrom: true,
  subject: true,
  textBody: true,
  rcptTo: true,
  gmailMessageId: true,
  inboundAddress: {
    select: { localPart: true, domain: true },
  },
  attachments: { select: { id: true }, take: 1 },
} as unknown as Prisma.InboundMessageSelect;

export const BOITE_INBOX_PER_PAGE_OPTIONS = [50, 100, 200] as const;
export type BoiteInboxPerPage = (typeof BOITE_INBOX_PER_PAGE_OPTIONS)[number];

function boiteWhere(archived: boolean): Prisma.InboundMessageWhereInput {
  return {
    archived,
    inboundAddress: { isActive: true },
    ...(archived ? {} : { NOT: whereHasSuccessfulForward }),
  };
}

export function parseBoiteInboxPagination(sp: {
  page?: string;
  perPage?: string;
}): { page: number; perPage: BoiteInboxPerPage } {
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const parsedPer = Number.parseInt(sp.perPage ?? "50", 10);
  const perPage = BOITE_INBOX_PER_PAGE_OPTIONS.includes(
    parsedPer as BoiteInboxPerPage,
  )
    ? (parsedPer as BoiteInboxPerPage)
    : 50;
  return { page, perPage };
}

export async function countBoiteMessages(archived: boolean): Promise<number> {
  return prisma.inboundMessage.count({ where: boiteWhere(archived) });
}

export async function loadBoiteMessages(
  archived: boolean,
  options?: { skip?: number; take?: number },
): Promise<BoiteListMessage[]> {
  const skip = options?.skip ?? 0;
  const take = options?.take ?? 150;
  return (await prisma.inboundMessage.findMany({
    where: boiteWhere(archived),
    orderBy: { receivedAt: "desc" },
    skip,
    take,
    select: boiteListMessageSelect,
  })) as unknown as BoiteListMessage[];
}

/** Messages pour lesquels une action FORWARD a reussi (regle ou raccourci manuel), non retirés par l’utilisateur. */
export async function loadTransferredMessages(take = 150): Promise<BoiteListMessage[]> {
  return (await prisma.inboundMessage.findMany({
    where: {
      inboundAddress: { isActive: true },
      hiddenFromTransferList: false,
      ...whereHasSuccessfulForward,
    },
    orderBy: { receivedAt: "desc" },
    take,
    select: boiteListMessageSelect,
  })) as unknown as BoiteListMessage[];
}
