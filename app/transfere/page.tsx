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

  const messages = await loadTransferredMessages();

  return (
    <DashboardShell
      currentTab="transfere"
      title="Transféré"
      userEmail={user.email}
      isAdmin={user.isAdmin}
      titleActions={<TransfereShortcutsHeader />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Messages pour lesquels un transfert a réussi : règle <strong>FORWARD</strong> ou envoi
          depuis la boîte via un raccourci.           L&apos;envoi utilise la boîte Gmail connectée (Réglages) si
          elle est disponible, sinon le SMTP sortant configuré. En cas d&apos;adresse invalide,
          l&apos;échec est pris en compte après réception du courrier de rebond (sync Gmail).
          Le bouton à droite retire l&apos;entrée de cette liste sans supprimer le message.
          Même présentation que la boîte ; les messages importés Gmail ont un id API (infobulle sur l&apos;heure).
        </p>

        <BoiteMessagesList
          messages={messages}
          emptyTitle="Aucun transfert enregistré"
          emptyDescription="Quand une règle transfère un mail avec succès, il apparaîtra ici. Les échecs d&apos;envoi ne sont pas listés."
          listAriaLabel="Messages transférés"
          showHideFromTransferListAction
        />
      </div>
    </DashboardShell>
  );
}
