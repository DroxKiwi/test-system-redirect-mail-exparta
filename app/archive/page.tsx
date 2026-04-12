import { redirect } from "next/navigation";
import { BoiteMessagesList } from "@/components/boite-messages-list";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";
import { loadBoiteMessages } from "@/lib/boite-messages";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const messages = await loadBoiteMessages(true);

  return (
    <DashboardShell
      currentTab="archive"
      title="Archive"
      userEmail={user.email}
      isAdmin={user.isAdmin}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Messages archivés : même présentation que la boîte de réception. Utilise l&apos;icône à
          droite ou la fiche message pour remettre un mail dans la boîte.
        </p>

        <BoiteMessagesList
          messages={messages}
          emptyTitle="Archive vide"
          emptyDescription="Archiver un message depuis la boîte ou sa fiche pour le retrouver ici."
          listAriaLabel="Messages archives"
          showUnarchiveAction
        />
      </div>
    </DashboardShell>
  );
}
