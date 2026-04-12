import { redirect } from "next/navigation";
import { BoiteComposeFab } from "@/components/boite-compose-fab";
import { BoiteGmailSync } from "@/components/boite-gmail-sync";
import { BoiteInboxPagination } from "@/components/boite-inbox-pagination";
import { BoiteMessagesList } from "@/components/boite-messages-list";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";
import {
  countBoiteMessages,
  loadBoiteMessages,
  parseBoiteInboxPagination,
} from "@/lib/boite-messages";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BoitePageProps = {
  searchParams?: Promise<{ page?: string; perPage?: string }>;
};

export default async function BoitePage({ searchParams }: BoitePageProps) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const sp = (await searchParams) ?? {};
  const { page: rawPage, perPage } = parseBoiteInboxPagination(sp);

  const [total, transferShortcuts, googleOAuth] = await Promise.all([
    countBoiteMessages(false),
    prisma.transferShortcut.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, emails: true },
    }),
    prisma.googleOAuthSettings.findUnique({
      where: { id: 1 },
      select: {
        gmailPollIntervalSeconds: true,
        gmailSyncUnreadOnly: true,
        refreshToken: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(rawPage, totalPages);
  const skip = (page - 1) * perPage;

  const messages = await loadBoiteMessages(false, { skip, take: perPage });

  const gmailPollIntervalSeconds = googleOAuth?.gmailPollIntervalSeconds ?? 0;
  const gmailSyncUnreadOnly = googleOAuth?.gmailSyncUnreadOnly !== false;
  const gmailConnected = Boolean(googleOAuth?.refreshToken?.trim());

  return (
    <DashboardShell
      currentTab="boite"
      title="Boite de reception"
      userEmail={user.email}
      isAdmin={user.isAdmin}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Messages enregistres (passerelle SMTP et/ou import Gmail), du plus recent au plus ancien.
          Pagination 50 / 100 / 200 par page. Les messages déjà transférés avec succès ne figurent plus
          ici (ils sont dans l&apos;onglet Transféré). Les messages archivés sont dans l&apos;onglet
          Archive. Survoler l&apos;heure d&apos;un message importé depuis Gmail affiche
          l&apos;identifiant côté API Google.
        </p>

        <BoiteInboxPagination page={page} perPage={perPage} total={total} />

        <BoiteGmailSync
          pollIntervalSeconds={gmailPollIntervalSeconds}
          gmailConnected={gmailConnected}
          gmailSyncUnreadOnly={gmailSyncUnreadOnly}
        />

        <BoiteMessagesList
          messages={messages}
          emptyTitle="Aucun message"
          emptyDescription="Des qu&apos;un mail arrive sur une adresse d&apos;entree (passerelle SMTP + regles), il apparaitra ici."
          listAriaLabel="Messages recus"
          showTransferAction
          transferShortcuts={transferShortcuts}
          showArchiveAction
        />

        <BoiteComposeFab />
      </div>
    </DashboardShell>
  );
}
