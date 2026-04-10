"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type SmtpSettingsResponse = {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  fromAddress: string;
  hasPassword: boolean;
  activeSource: "database" | "environment" | "none";
  envConfigured: boolean;
};

export function SmtpSettingsForm() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(false);
  const [authUser, setAuthUser] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [activeSource, setActiveSource] =
    useState<SmtpSettingsResponse["activeSource"]>("none");
  const [envConfigured, setEnvConfigured] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testSendPending, setTestSendPending] = useState(false);
  const [testInPending, setTestInPending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/smtp");
      const data = (await res.json()) as SmtpSettingsResponse & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Chargement impossible.");
        return;
      }
      setHost(data.host);
      setPort(String(data.port));
      setSecure(data.secure);
      setAuthUser(data.authUser);
      setFromAddress(data.fromAddress);
      setHasPassword(data.hasPassword);
      setActiveSource(data.activeSource);
      setEnvConfigured(data.envConfigured);
      setAuthPassword("");
    } catch {
      setError("Erreur reseau.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    const portNum = Number.parseInt(port, 10);
    if (!Number.isFinite(portNum)) {
      setError("Port invalide.");
      setSaving(false);
      return;
    }
    try {
      const body: Record<string, unknown> = {
        host: host.trim(),
        port: portNum,
        secure,
        authUser: authUser.trim(),
        fromAddress: fromAddress.trim(),
      };
      if (authPassword.trim()) {
        body.authPassword = authPassword.trim();
      }
      const res = await fetch("/api/settings/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Enregistrement impossible.");
        return;
      }
      setMessage("Configuration SMTP enregistree.");
      setAuthPassword("");
      await load();
    } catch {
      setError("Erreur reseau.");
    } finally {
      setSaving(false);
    }
  }

  async function runTestSend() {
    setTestSendPending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/smtp/test-send", {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Test envoi echoue.");
        return;
      }
      setMessage(data.message ?? "Test envoi reussi.");
    } catch {
      setError("Erreur reseau.");
    } finally {
      setTestSendPending(false);
    }
  }

  async function runTestInbound() {
    setTestInPending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/smtp/test-inbound", {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Test reception echoue.");
        return;
      }
      setMessage(data.message ?? "Test reception declenche.");
    } catch {
      setError("Erreur reseau.");
    } finally {
      setTestInPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMTP sortant (transferts)</CardTitle>
        <CardDescription>
          Parametres utilises pour l&apos;action de regle <strong>Transfert</strong>. Si le
          champ <span className="font-mono">Serveur</span> est rempli ici, cette configuration
          remplace les variables <span className="font-mono">SMTP_OUTBOUND_*</span> du fichier
          d&apos;environnement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <div
              className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
              role="status"
            >
              Source active :{" "}
              <strong className="text-foreground">
                {activeSource === "database"
                  ? "Base de donnees (ce formulaire)"
                  : activeSource === "environment"
                    ? "Variables d'environnement"
                    : "Aucune (configure au moins une source)"}
              </strong>
              {activeSource === "environment" && envConfigured ? (
                <span className="ml-1">
                  — les champs ci-dessous sont des brouillons jusqu&apos;a enregistrement.
                </span>
              ) : null}
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}
            {message ? (
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {message}
              </div>
            ) : null}

            <form className="flex flex-col gap-4" onSubmit={handleSave}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor="smtp-host">Serveur SMTP</Label>
                  <Input
                    id="smtp-host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="smtp.example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3 pt-8">
                  <Switch
                    id="smtp-secure"
                    checked={secure}
                    onCheckedChange={(v) => setSecure(v === true)}
                  />
                  <Label htmlFor="smtp-secure" className="font-normal">
                    TLS implicite (port 465)
                  </Label>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-user">Utilisateur (optionnel)</Label>
                  <Input
                    id="smtp-user"
                    value={authUser}
                    onChange={(e) => setAuthUser(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-pass">
                    Mot de passe {hasPassword ? "(laisser vide pour conserver)" : ""}
                  </Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={hasPassword ? "••••••••" : ""}
                  />
                </div>
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label htmlFor="smtp-from">Adresse d&apos;expedition (From)</Label>
                  <Input
                    id="smtp-from"
                    type="email"
                    value={fromAddress}
                    onChange={(e) => setFromAddress(e.target.value)}
                    placeholder="noreply@ton-domaine.com"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={testSendPending}
                  onClick={() => void runTestSend()}
                >
                  {testSendPending ? "Test envoi…" : "Tester l'envoi"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={testInPending}
                  onClick={() => void runTestInbound()}
                >
                  {testInPending ? "Test reception…" : "Tester la reception (API)"}
                </Button>
              </div>
            </form>
          </>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>
          <strong>Tester l&apos;envoi</strong> : envoie un e-mail a l&apos;adresse de ton compte.
        </p>
        <p>
          <strong>Tester la reception (API)</strong> : appelle l&apos;endpoint inbound comme la
          passerelle Python (sans SMTP). Necessite une adresse d&apos;entree en base et{" "}
          <span className="font-mono">INBOUND_SECRET</span>.
        </p>
        <p>
          Le mot de passe SMTP est stocke en base en clair ; reserve cette instance a un
          environnement de confiance ou chiffre la base au repos.
        </p>
      </CardFooter>
    </Card>
  );
}
