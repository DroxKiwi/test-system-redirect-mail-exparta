import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";
import { ReglagesTransferShortcutsCard } from "@/components/reglages-transfer-shortcuts-card";
import { CloudMailboxSettings } from "./cloud-mailbox-settings";

export default async function ReglagesPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell
      currentTab="reglages"
      title="Reglages"
      userEmail={user.email}
      isAdmin={user.isAdmin}
    >
      <div className="flex flex-col gap-8">
        <div data-tutorial-target="tutoriel-reglages-raccourcis">
          <ReglagesTransferShortcutsCard />
        </div>
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <CardTitle>Boite mail cloud</CardTitle>
                <CardDescription>Chargement…</CardDescription>
              </CardHeader>
            </Card>
          }
        >
          <div data-tutorial-target="tutoriel-reglages-cloud">
            <CloudMailboxSettings />
          </div>
        </Suspense>
      </div>
    </DashboardShell>
  );
}
