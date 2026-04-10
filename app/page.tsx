import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell currentTab="flux" title="Tableau de bord" userEmail={user.email}>
      <p className="text-sm text-muted-foreground">
        Bienvenue. Tu peux commencer par configurer tes regles dans l&apos;onglet Flux.
      </p>
    </DashboardShell>
  );
}
