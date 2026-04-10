import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  RuleActionType,
  RuleField,
  RuleOperator,
} from "@prisma/client";
import { getSessionUser } from "@/lib/auth-user";
import { prisma } from "@/lib/prisma";

const RULE_FIELDS = new Set(Object.values(RuleField));
const RULE_OPERATORS = new Set(Object.values(RuleOperator));
const ACTION_TYPES = new Set(Object.values(RuleActionType));

type ConditionInput = {
  field: RuleField;
  headerName?: string | null;
  operator: RuleOperator;
  value: string;
  caseSensitive?: boolean;
};

type ActionInput = {
  type: RuleActionType;
  order: number;
  config: Record<string, unknown>;
};

function validateConditions(items: ConditionInput[]): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return "Ajoute au moins une condition.";
  }
  for (const c of items) {
    if (!RULE_FIELDS.has(c.field)) {
      return "Champ de condition invalide.";
    }
    if (!RULE_OPERATORS.has(c.operator)) {
      return "Operateur invalide.";
    }
    if (typeof c.value !== "string") {
      return "Valeur de condition invalide.";
    }
    if (c.field === "HEADER") {
      const name = (c.headerName ?? "").trim();
      if (!name) {
        return "Pour une condition sur un en-tete, indique le nom de l en-tete.";
      }
    }
  }
  return null;
}

function validateActions(items: ActionInput[]): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return "Ajoute au moins une action.";
  }
  for (const a of items) {
    if (!ACTION_TYPES.has(a.type)) {
      return "Type d action invalide.";
    }
    if (typeof a.order !== "number" || !Number.isFinite(a.order)) {
      return "Ordre d action invalide.";
    }
    const cfg = a.config;
    if (!cfg || typeof cfg !== "object") {
      return "Configuration d action invalide.";
    }
    if (a.type === "FORWARD") {
      const to = typeof cfg.to === "string" ? cfg.to.trim() : "";
      if (!to) {
        return "L action Transfert necessite une adresse e-mail de destination.";
      }
    }
    if (a.type === "REWRITE_SUBJECT") {
      const mode = cfg.mode;
      if (mode === "prefix") {
        const prefix = typeof cfg.prefix === "string" ? cfg.prefix : "";
        if (!prefix.trim()) {
          return "Le prefixe de sujet est requis.";
        }
      } else if (mode === "replace") {
        const subject = typeof cfg.subject === "string" ? cfg.subject : "";
        if (!subject.trim()) {
          return "Le nouveau sujet est requis.";
        }
      } else {
        return "Mode de reecriture de sujet invalide (prefix ou replace).";
      }
    }
    if (a.type === "PREPEND_TEXT") {
      const text = typeof cfg.text === "string" ? cfg.text : "";
      if (!text.trim()) {
        return "Le texte a ajouter au corps est requis.";
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Nom de la regle requis." }, { status: 400 });
  }

  const enabled = b.enabled !== false;
  const priority =
    typeof b.priority === "number" && Number.isFinite(b.priority)
      ? Math.floor(b.priority)
      : 100;
  const stopProcessing = b.stopProcessing !== false;

  let inboundAddressId: number | null = null;
  if (b.inboundAddressId != null && b.inboundAddressId !== "") {
    const id = Number(b.inboundAddressId);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: "Adresse d entree invalide." },
        { status: 400 }
      );
    }
    inboundAddressId = id;
    const addr = await prisma.inboundAddress.findFirst({
      where: { id, userId: user.id, isActive: true },
      select: { id: true },
    });
    if (!addr) {
      return NextResponse.json(
        { error: "Adresse d entree introuvable." },
        { status: 400 }
      );
    }
  }

  const conditions = b.conditions as ConditionInput[];
  const condErr = validateConditions(conditions);
  if (condErr) {
    return NextResponse.json({ error: condErr }, { status: 400 });
  }

  const actions = b.actions as ActionInput[];
  const actErr = validateActions(actions);
  if (actErr) {
    return NextResponse.json({ error: actErr }, { status: 400 });
  }

  const conditionCreates: Prisma.RuleConditionCreateWithoutRuleInput[] =
    conditions.map((c) => ({
      field: c.field,
      headerName:
        c.field === "HEADER" ? (c.headerName ?? "").trim() || null : null,
      operator: c.operator,
      value: c.value,
      caseSensitive: Boolean(c.caseSensitive),
    }));

  const actionCreates: Prisma.RuleActionCreateWithoutRuleInput[] = actions.map(
    (a) => ({
      type: a.type,
      order: a.order,
      config: a.config as Prisma.InputJsonValue,
    })
  );

  const rule = await prisma.rule.create({
    data: {
      userId: user.id,
      inboundAddressId,
      name,
      enabled,
      priority,
      stopProcessing,
      conditions: { create: conditionCreates },
      actions: { create: actionCreates },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ ok: true, rule });
}
