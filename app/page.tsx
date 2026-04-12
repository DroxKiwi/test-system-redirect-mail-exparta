import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell title="Tableau de bord" userEmail={user.email} isAdmin={user.isAdmin}>
      <p className="text-sm text-muted-foreground">
        Bienvenue. Configure tes regles dans l&apos;onglet Reglages et tes adresses d&apos;entree selon ton
        deploiement.
      </p>
    </DashboardShell>
  );
}
