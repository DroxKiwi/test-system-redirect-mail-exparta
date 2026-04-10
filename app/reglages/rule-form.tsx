"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type AddressOption = { id: number; localPart: string; domain: string };

const RULE_FIELDS = [
  { value: "FROM", label: "Expediteur (From)", hint: "Adresse ou partie de l expediteur." },
  { value: "SUBJECT", label: "Sujet", hint: "Champ Subject du mail." },
  { value: "BODY", label: "Corps (texte)", hint: "Corps texte brut si disponible apres parsing." },
  {
    value: "HEADER",
    label: "En-tete MIME",
    hint: "Ex. List-Unsubscribe, X-Custom-Id. Precise le nom exact de l en-tete.",
  },
] as const;

const OPERATORS = [
  { value: "CONTAINS", label: "contient" },
  { value: "EQUALS", label: "est egal a" },
  { value: "STARTS_WITH", label: "commence par" },
  { value: "REGEX", label: "correspond a (regex)" },
] as const;

const ACTION_TYPES = [
  {
    value: "FORWARD",
    label: "Transfert",
    hint: "Envoie une copie (ou le message modifie) vers une autre adresse.",
  },
  {
    value: "REWRITE_SUBJECT",
    label: "Reecrire le sujet",
    hint: "Ajoute un prefixe ou remplace tout le sujet avant les actions suivantes.",
  },
  {
    value: "PREPEND_TEXT",
    label: "Prefixer le corps",
    hint: "Ajoute du texte au debut du corps (texte brut).",
  },
  {
    value: "DROP",
    label: "Abandonner",
    hint: "Ne pas transmettre le message (apres eventuelles modifs en memoire).",
  },
] as const;

type ConditionRow = {
  key: string;
  field: string;
  headerName: string;
  operator: string;
  value: string;
  caseSensitive: boolean;
};

type ActionRow = {
  key: string;
  type: string;
  order: number;
  forwardTo: string;
  subjectMode: "prefix" | "replace";
  subjectPrefix: string;
  subjectReplace: string;
  prependText: string;
};

/** Cles pour nouvelles lignes : uniquement depuis des handlers client (pas dans l etat initial SSR). */
function newRowKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function RuleForm({ addresses }: { addresses: AddressOption[] }) {
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(100);
  const [stopProcessing, setStopProcessing] = useState(true);
  const [inboundAddressId, setInboundAddressId] = useState<string>("__all__");

  const [conditions, setConditions] = useState<ConditionRow[]>([
    {
      key: "condition-default",
      field: "SUBJECT",
      headerName: "",
      operator: "CONTAINS",
      value: "",
      caseSensitive: false,
    },
  ]);

  const [actions, setActions] = useState<ActionRow[]>([
    {
      key: "action-default",
      type: "FORWARD",
      order: 1,
      forwardTo: "",
      subjectMode: "prefix",
      subjectPrefix: "",
      subjectReplace: "",
      prependText: "",
    },
  ]);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const addressLabel = useMemo(
    () => (a: AddressOption) => `${a.localPart}@${a.domain}`,
    []
  );

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      {
        key: newRowKey("condition"),
        field: "SUBJECT",
        headerName: "",
        operator: "CONTAINS",
        value: "",
        caseSensitive: false,
      },
    ]);
  }

  function removeCondition(key: string) {
    setConditions((prev) =>
      prev.length <= 1 ? prev : prev.filter((c) => c.key !== key)
    );
  }

  function updateCondition(key: string, patch: Partial<ConditionRow>) {
    setConditions((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...patch } : c))
    );
  }

  function addAction() {
    setActions((prev) => [
      ...prev,
      {
        key: newRowKey("action"),
        type: "FORWARD",
        order: prev.length + 1,
        forwardTo: "",
        subjectMode: "prefix",
        subjectPrefix: "",
        subjectReplace: "",
        prependText: "",
      },
    ]);
  }

  function removeAction(key: string) {
    setActions((prev) =>
      prev.length <= 1 ? prev : prev.filter((a) => a.key !== key)
    );
  }

  function updateAction(key: string, patch: Partial<ActionRow>) {
    setActions((prev) =>
      prev.map((a) => (a.key === key ? { ...a, ...patch } : a))
    );
  }

  function buildPayload() {
    const condPayload = conditions.map((c) => ({
      field: c.field,
      headerName: c.field === "HEADER" ? c.headerName : null,
      operator: c.operator,
      value: c.value,
      caseSensitive: c.caseSensitive,
    }));

    const actPayload = actions.map((a) => {
      let config: Record<string, unknown> = {};
      if (a.type === "FORWARD") {
        config = { to: a.forwardTo.trim() };
      } else if (a.type === "REWRITE_SUBJECT") {
        if (a.subjectMode === "prefix") {
          config = { mode: "prefix", prefix: a.subjectPrefix };
        } else {
          config = { mode: "replace", subject: a.subjectReplace };
        }
      } else if (a.type === "PREPEND_TEXT") {
        config = { text: a.prependText };
      } else if (a.type === "DROP") {
        config = {};
      }
      return { type: a.type, order: a.order, config };
    });

    return {
      name: name.trim(),
      enabled,
      priority,
      stopProcessing,
      inboundAddressId:
        inboundAddressId === "__all__" ? null : Number(inboundAddressId),
      conditions: condPayload,
      actions: actPayload,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erreur serveur.");
        return;
      }
      setMessage(`Regle enregistree (id ${(data as { rule?: { id: number } }).rule?.id}).`);
      setName("");
      setConditions([
        {
          key: newRowKey("condition"),
          field: "SUBJECT",
          headerName: "",
          operator: "CONTAINS",
          value: "",
          caseSensitive: false,
        },
      ]);
      setActions([
        {
          key: newRowKey("action"),
          type: "FORWARD",
          order: 1,
          forwardTo: "",
          subjectMode: "prefix",
          subjectPrefix: "",
          subjectReplace: "",
          prependText: "",
        },
      ]);
    } catch {
      setError("Erreur reseau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Comment fonctionne une regle ?</CardTitle>
          <CardDescription>
            Une regle dit : <strong>si toutes les conditions</strong> ci-dessous sont
            vraies (logique ET), alors on execute <strong>les actions</strong> dans
            l&apos;ordre indique. Si tu coches &quot;Arreter apres cette regle&quot;, les
            regles suivantes (priorite plus basse) ne seront pas evaluees.
          </CardDescription>
        </CardHeader>
      </Card>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>En-tete de la regle</CardTitle>
          <CardDescription>
            Portee : une adresse d&apos;entree precise, ou toutes tes adresses si tu laisses
            &quot;Toutes&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-name">Nom (affichage)</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Factures vers compta"
              required
              disabled={pending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Adresse d&apos;entree</Label>
              <Select
                value={inboundAddressId}
                onValueChange={setInboundAddressId}
                disabled={pending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Toutes les adresses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes les adresses</SelectItem>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {addressLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Si tu choisis une adresse, la regle ne s&apos;applique qu&apos;aux mails
                recus sur <code className="rounded bg-muted px-1">local@domain</code> de
                cette ligne.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Priorite (nombre)</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Plus le nombre est <strong>petit</strong>, plus la regle est evaluee{" "}
                <strong>tot</strong> (convention du moteur).
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enabled"
                checked={enabled}
                onCheckedChange={(v) => setEnabled(v === true)}
                disabled={pending}
              />
              <Label htmlFor="enabled" className="font-normal">
                Regle active
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="stop"
                checked={stopProcessing}
                onCheckedChange={(v) => setStopProcessing(v === true)}
                disabled={pending}
              />
              <Label htmlFor="stop" className="font-normal">
                Arreter apres cette regle (ne pas evaluer les suivantes)
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Conditions (ET logique)</CardTitle>
              <CardDescription>
                Toutes les lignes doivent etre vraies pour declencher les actions.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCondition}>
              Ajouter une condition
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {conditions.map((c, index) => (
            <div key={c.key}>
              {index > 0 ? <Separator className="mb-6" /> : null}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Condition {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeCondition(c.key)}
                    disabled={pending || conditions.length <= 1}
                  >
                    Retirer
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>Champ teste</Label>
                    <Select
                      value={c.field}
                      onValueChange={(v) => updateCondition(c.key, { field: v })}
                      disabled={pending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RULE_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {
                        RULE_FIELDS.find((f) => f.value === c.field)?.hint
                      }
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Operateur</Label>
                    <Select
                      value={c.operator}
                      onValueChange={(v) => updateCondition(c.key, { operator: v })}
                      disabled={pending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {c.field === "HEADER" ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`hn-${c.key}`}>Nom de l&apos;en-tete</Label>
                    <Input
                      id={`hn-${c.key}`}
                      value={c.headerName}
                      onChange={(e) =>
                        updateCondition(c.key, { headerName: e.target.value })
                      }
                      placeholder="List-Unsubscribe"
                      disabled={pending}
                    />
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`cv-${c.key}`}>Valeur / motif</Label>
                  <Input
                    id={`cv-${c.key}`}
                    value={c.value}
                    onChange={(e) => updateCondition(c.key, { value: e.target.value })}
                    placeholder={
                      c.operator === "REGEX"
                        ? "^facture-[0-9]+"
                        : "Texte a comparer"
                    }
                    disabled={pending}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`cs-${c.key}`}
                    checked={c.caseSensitive}
                    onCheckedChange={(v) =>
                      updateCondition(c.key, { caseSensitive: v === true })
                    }
                    disabled={pending}
                  />
                  <Label htmlFor={`cs-${c.key}`} className="font-normal">
                    Sensible a la casse
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Actions (ordre d&apos;execution)</CardTitle>
              <CardDescription>
                Executees dans l&apos;ordre croissant du champ &quot;Ordre&quot;. Les
                modifications (sujet, corps) s&apos;appliquent en memoire avant un
                eventuel transfert.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addAction}>
              Ajouter une action
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {actions.map((a, index) => (
            <div key={a.key}>
              {index > 0 ? <Separator className="mb-6" /> : null}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Action {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeAction(a.key)}
                    disabled={pending || actions.length <= 1}
                  >
                    Retirer
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>Type</Label>
                    <Select
                      value={a.type}
                      onValueChange={(v) => updateAction(a.key, { type: v })}
                      disabled={pending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {ACTION_TYPES.find((t) => t.value === a.type)?.hint}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`ord-${a.key}`}>Ordre</Label>
                    <Input
                      id={`ord-${a.key}`}
                      type="number"
                      min={1}
                      value={a.order}
                      onChange={(e) =>
                        updateAction(a.key, { order: Number(e.target.value) })
                      }
                      disabled={pending}
                    />
                  </div>
                </div>

                {a.type === "FORWARD" ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`ft-${a.key}`}>Transfert vers (e-mail)</Label>
                    <Input
                      id={`ft-${a.key}`}
                      type="email"
                      value={a.forwardTo}
                      onChange={(e) =>
                        updateAction(a.key, { forwardTo: e.target.value })
                      }
                      placeholder="compta@entreprise.com"
                      disabled={pending}
                    />
                  </div>
                ) : null}

                {a.type === "REWRITE_SUBJECT" ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Mode</Label>
                      <Select
                        value={a.subjectMode}
                        onValueChange={(v) =>
                          updateAction(a.key, {
                            subjectMode: v as "prefix" | "replace",
                          })
                        }
                        disabled={pending}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prefix">Prefixer le sujet</SelectItem>
                          <SelectItem value="replace">Remplacer tout le sujet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {a.subjectMode === "prefix" ? (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`sp-${a.key}`}>Prefixe</Label>
                        <Input
                          id={`sp-${a.key}`}
                          value={a.subjectPrefix}
                          onChange={(e) =>
                            updateAction(a.key, { subjectPrefix: e.target.value })
                          }
                          placeholder="[FACTURE] "
                          disabled={pending}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`sr-${a.key}`}>Nouveau sujet</Label>
                        <Input
                          id={`sr-${a.key}`}
                          value={a.subjectReplace}
                          onChange={(e) =>
                            updateAction(a.key, { subjectReplace: e.target.value })
                          }
                          disabled={pending}
                        />
                      </div>
                    )}
                  </div>
                ) : null}

                {a.type === "PREPEND_TEXT" ? (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`pt-${a.key}`}>Texte a ajouter en tete du corps</Label>
                    <Textarea
                      id={`pt-${a.key}`}
                      value={a.prependText}
                      onChange={(e) =>
                        updateAction(a.key, { prependText: e.target.value })
                      }
                      rows={4}
                      disabled={pending}
                    />
                  </div>
                ) : null}

                {a.type === "DROP" ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun champ supplementaire : le message ne sera pas transmis apres
                    cette action (selon le moteur que nous brancherons ensuite).
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Enregistrement…" : "Enregistrer la regle"}
      </Button>
    </form>
  );
}
