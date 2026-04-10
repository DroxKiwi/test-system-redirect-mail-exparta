import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";

export default async function FluxPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell currentTab="flux" title="Flux" userEmail={user.email}>
      <p className="text-sm text-muted-foreground">
        Page en cours de construction.
      </p>
    </DashboardShell>
  );
}
