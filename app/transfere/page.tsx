import { redirect } from "next/navigation";
import { BoiteMessagesList } from "@/components/boite-messages-list";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";
import { loadTransferredMessages } from "@/lib/boite-messages";
import { TransfereShortcutsHeader } from "@/components/transfere-shortcuts-header";

export const dynamic = "force-dynamic";

export default async function TransferePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const messages = await loadTransferredMessages(user.id);

  return (
    <DashboardShell
      currentTab="transfere"
      title="Transféré"
      userEmail={user.email}
      titleActions={<TransfereShortcutsHeader />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Messages pour lesquels un transfert a réussi : règle <strong>FORWARD</strong> ou envoi
          depuis la boîte via un raccourci. Le courrier a été envoyé par SMTP vers une autre adresse.
          Même présentation que la boîte, sans actions rapides sur la ligne.
        </p>

        <BoiteMessagesList
          messages={messages}
          emptyTitle="Aucun transfert enregistré"
          emptyDescription="Quand une règle transfère un mail avec succès, il apparaîtra ici. Les échecs d&apos;envoi ne sont pas listés."
          listAriaLabel="Messages transférés"
        />
      </div>
    </DashboardShell>
  );
}
