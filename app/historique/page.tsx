import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

function directionBadge(direction: string) {
  const d = direction.toLowerCase();
  if (d === "out") {
    return (
      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
        Sortant
      </span>
    );
  }
  if (d === "in") {
    return (
      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Entrant
      </span>
    );
  }
  return (
    <span className="rounded-md border border-border px-2 py-0.5 text-xs">
      {direction}
    </span>
  );
}

function actorLabel(actor: string) {
  if (actor === "smtp-gateway") {
    return "Passerelle SMTP";
  }
  if (actor === "next") {
    return "Application";
  }
  return actor;
}

export default async function HistoriquePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const events = await prisma.mailFlowEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <DashboardShell
      currentTab="historique"
      title="Historique"
      userEmail={user.email}
      isAdmin={user.isAdmin}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Fils d&apos;evenements entre la reception SMTP et Next (meme{" "}
          <span className="font-mono text-xs">correlationId</span> / trace). Journal partage pour
          toute l&apos;instance (les 500 derniers evenements).
        </p>

        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun evenement pour le moment. Envoie un mail de test vers la passerelle une fois une
            adresse d&apos;entree configuree.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Sens</th>
                  <th className="px-3 py-2 font-semibold">Acteur</th>
                  <th className="px-3 py-2 font-semibold">Etape</th>
                  <th className="px-3 py-2 font-semibold">Resume</th>
                  <th className="px-3 py-2 font-semibold">Trace</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-border/80 align-top hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {ev.createdAt.toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                    <td className="px-3 py-2">{directionBadge(ev.direction)}</td>
                    <td className="px-3 py-2">{actorLabel(ev.actor)}</td>
                    <td className="max-w-[140px] break-words px-3 py-2 font-mono text-xs">
                      {ev.step}
                    </td>
                    <td className="max-w-md px-3 py-2">{ev.summary}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {ev.correlationId.slice(0, 8)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
