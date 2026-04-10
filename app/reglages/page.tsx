import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";
import { RuleForm } from "./rule-form";
import { SmtpSettingsForm } from "./smtp-settings-form";

export default async function ReglagesPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const [addresses, rules] = await Promise.all([
    prisma.inboundAddress.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, localPart: true, domain: true },
    }),
    prisma.rule.findMany({
      where: { userId: user.id },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        enabled: true,
        priority: true,
        stopProcessing: true,
        inboundAddress: {
          select: { localPart: true, domain: true },
        },
        _count: { select: { conditions: true, actions: true } },
      },
    }),
  ]);

  return (
    <DashboardShell currentTab="reglages" title="Reglages" userEmail={user.email}>
      <div className="flex flex-col gap-8">
        <SmtpSettingsForm />

        {addresses.length === 0 ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-base">Aucune adresse d&apos;entree</CardTitle>
              <CardDescription>
                Cree au moins une ligne dans <code className="rounded bg-muted px-1">InboundAddress</code>{" "}
                (Prisma Studio ou seed) pour lier des mails entrants a ton compte. Tu pourras alors restreindre
                une regle a une adresse precise.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <RuleForm addresses={addresses} />

        <Card>
          <CardHeader>
            <CardTitle>Tes regles enregistrees</CardTitle>
            <CardDescription>
              Rappel : priorite <strong>plus petite</strong> = evaluee <strong>avant</strong>. Le moteur
              d&apos;execution sur les mails entrants sera branche ensuite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune regle pour le moment.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {rules.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border px-3 py-2"
                  >
                    <div className="font-medium">
                      {r.name}{" "}
                      <span className="text-muted-foreground">
                        (priorite {r.priority}
                        {r.enabled ? "" : ", desactivee"})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Portee :{" "}
                      {r.inboundAddress
                        ? `${r.inboundAddress.localPart}@${r.inboundAddress.domain}`
                        : "toutes les adresses"}
                      {" · "}
                      {r.stopProcessing
                        ? "arret apres cette regle"
                        : "les regles suivantes peuvent aussi s'appliquer"}
                      {" · "}
                      {r._count.conditions} condition(s), {r._count.actions} action(s)
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
