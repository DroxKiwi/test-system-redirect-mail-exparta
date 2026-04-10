import { redirect } from "next/navigation";
import { BoiteMessagesList } from "@/components/boite-messages-list";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";
import { loadBoiteMessages } from "@/lib/boite-messages";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BoitePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [messages, transferShortcuts] = await Promise.all([
    loadBoiteMessages(user.id, false),
    prisma.transferShortcut.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, emails: true },
    }),
  ]);

  return (
    <DashboardShell currentTab="boite" title="Boite de reception" userEmail={user.email}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Messages enregistres pour tes adresses d&apos;entree, du plus recent au plus ancien (150
          max.). Les messages archivés sont dans l&apos;onglet Archive.
        </p>

        <BoiteMessagesList
          messages={messages}
          emptyTitle="Aucun message"
          emptyDescription="Des qu&apos;un mail arrive sur une de tes adresses (passerelle SMTP + regles), il apparaitra ici."
          listAriaLabel="Messages recus"
          showTransferAction
          transferShortcuts={transferShortcuts}
          showArchiveAction
        />
      </div>
    </DashboardShell>
  );
}
