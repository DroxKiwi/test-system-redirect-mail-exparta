import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AssistantSessionContext } from "@/lib/assistant/session-types";
import {
  catalogEntryForEntity,
  DB_ENTITY_CATALOG,
  entityAllowedForSession,
} from "@/lib/assistant/db-read/catalog";

const MAX_TAKE = 75;
const MAX_TEXT_BODY_LIST = 2000;

export function dbListEntitiesForSession(isAdmin: boolean) {
  return {
    entities: DB_ENTITY_CATALOG.filter((e) => !e.adminOnly || isAdmin).map(
      ({ key, description, adminOnly }) => ({
        key,
        description,
        adminOnly,
      }),
    ),
    note: "Use db_read with entity = key to list rows or read one by id.",
  };
}

type WhereClause = { field: string; op: string; value: unknown };

function asWhereList(v: unknown): WhereClause[] | null {
  if (!Array.isArray(v)) return null;
  const out: WhereClause[] = [];
  for (const item of v) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.field !== "string" || typeof o.op !== "string") continue;
    out.push({ field: o.field.trim(), op: o.op.trim().toLowerCase(), value: o.value });
  }
  return out;
}

function clampTake(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 30;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_TAKE);
}

function clampSkip(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(Math.trunc(n), 0);
}

/** Applique des filtres simples eq / contains sur des champs autorisés (racine du modèle). */
function simpleWhere(
  allowed: Set<string>,
  clauses: WhereClause[] | null,
): Record<string, unknown> {
  if (!clauses?.length) return {};
  const parts: Record<string, unknown>[] = [];
  for (const c of clauses) {
    if (!allowed.has(c.field)) continue;
    const v = c.value;
    if (c.op === "eq") {
      if (typeof v === "boolean") {
        parts.push({ [c.field]: v });
      } else if (typeof v === "number" && Number.isFinite(v)) {
        parts.push({ [c.field]: Math.trunc(v) });
      } else if (typeof v === "string") {
        parts.push({
          [c.field]: { equals: v, mode: "insensitive" },
        });
      }
    } else if (c.op === "contains" && typeof v === "string") {
      parts.push({
        [c.field]: { contains: v, mode: "insensitive" },
      });
    }
  }
  if (parts.length === 0) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

function orderByClause(
  allowed: Set<string>,
  field: unknown,
  dir: unknown,
): Record<string, "asc" | "desc"> | undefined {
  if (typeof field !== "string" || !allowed.has(field.trim())) return undefined;
  const d =
    typeof dir === "string" && dir.toLowerCase() === "asc" ? "asc" : "desc";
  return { [field.trim()]: d };
}

function truncateInboundMessageList(
  rows: {
    textBody: string | null;
    htmlBody: string | null;
    rawMime: string;
  }[],
) {
  return rows.map((r) => ({
    ...r,
    textBody:
      r.textBody && r.textBody.length > MAX_TEXT_BODY_LIST
        ? `${r.textBody.slice(0, MAX_TEXT_BODY_LIST)}…`
        : r.textBody,
    htmlBody: r.htmlBody ? "[html omitted in list]" : null,
    rawMime: "[omitted — use get_inbox_message for body]",
  }));
}

function redactUser<T extends { passwordHash?: unknown; sessionToken?: unknown }>(
  row: T,
) {
  const { passwordHash: _p, sessionToken: _s, ...rest } = row;
  return rest;
}

function redactOAuth(row: Record<string, unknown>) {
  const out = { ...row };
  if ("clientSecret" in out) {
    out.clientSecret = out.clientSecret ? "[redacted]" : null;
  }
  if ("refreshToken" in out) {
    out.refreshToken = out.refreshToken ? "[redacted]" : null;
  }
  return out;
}

export async function executeDbRead(
  input: {
    entity: string;
    operation: string;
    id?: unknown;
    take?: unknown;
    skip?: unknown;
    orderByField?: unknown;
    orderByDir?: unknown;
    where?: unknown;
  },
  session: AssistantSessionContext,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const key = input.entity.trim().toLowerCase();
  if (!catalogEntryForEntity(key)) {
    return { ok: false, error: `Unknown entity: ${input.entity}. Use db_list_entities.` };
  }
  if (!entityAllowedForSession(key, session.isAdmin)) {
    return {
      ok: false,
      error: `Entity "${key}" is reserved for administrators.`,
    };
  }

  const op = (input.operation ?? "list").toString().trim().toLowerCase();
  const take = clampTake(input.take);
  const skip = clampSkip(input.skip);
  const whereList = asWhereList(input.where);

  try {
    switch (key) {
      case "user": {
        if (op === "get") {
          const id =
            typeof input.id === "number"
              ? Math.trunc(input.id)
              : typeof input.id === "string"
                ? parseInt(input.id, 10)
                : NaN;
          if (!Number.isFinite(id) || id < 1) {
            return { ok: false, error: "db_read user get requires id (positive integer)." };
          }
          const row = await prisma.user.findUnique({ where: { id } });
          if (!row) return { ok: true, data: { row: null } };
          return { ok: true, data: { row: redactUser(row) } };
        }
        const rows = await prisma.user.findMany({
          take,
          skip,
          orderBy: orderByClause(
            new Set(["id", "email", "username", "createdAt"]),
            input.orderByField,
            input.orderByDir,
          ) ?? { id: "asc" },
          where: simpleWhere(
            new Set(["isAdmin"]),
            whereList,
          ) as Prisma.UserWhereInput,
        });
        return {
          ok: true,
          data: { rows: rows.map(redactUser), count: rows.length },
        };
      }

      case "transfer_shortcut": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.transferShortcut.findUnique({ where: { id } });
          return { ok: true, data: { row } };
        }
        const rows = await prisma.transferShortcut.findMany({
          take,
          skip,
          orderBy: { id: "desc" },
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "mail_flow_event": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.mailFlowEvent.findUnique({ where: { id } });
          return { ok: true, data: { row } };
        }
        const ob =
          orderByClause(
            new Set(["id", "createdAt", "correlationId", "step"]),
            input.orderByField,
            input.orderByDir,
          ) ?? { createdAt: "desc" };
        const w = simpleWhere(
          new Set(["correlationId", "actor", "step", "direction"]),
          whereList,
        ) as Prisma.MailFlowEventWhereInput;
        const rows = await prisma.mailFlowEvent.findMany({
          take,
          skip,
          orderBy: ob as Prisma.MailFlowEventOrderByWithRelationInput,
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "inbound_address": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.inboundAddress.findUnique({ where: { id } });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["localPart", "domain", "isActive"]),
          whereList,
        ) as Prisma.InboundAddressWhereInput;
        const rows = await prisma.inboundAddress.findMany({
          take,
          skip,
          orderBy: { id: "asc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "filter": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.filter.findUnique({
            where: { id },
            include: { conditions: true },
          });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["name", "enabled", "inboundAddressId"]),
          whereList,
        ) as Prisma.FilterWhereInput;
        const rows = await prisma.filter.findMany({
          take,
          skip,
          orderBy: { priority: "asc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "automation": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.automation.findUnique({
            where: { id },
            include: { filterLinks: true, rule: true },
          });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["name", "enabled"]),
          whereList,
        ) as Prisma.AutomationWhereInput;
        const rows = await prisma.automation.findMany({
          take,
          skip,
          orderBy: { priority: "asc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "automation_on_filter": {
        const rows = await prisma.automationOnFilter.findMany({
          take,
          skip,
          orderBy: [{ automationId: "asc" }, { filterId: "asc" }],
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "filter_condition": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.filterCondition.findUnique({ where: { id } });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["filterId"]),
          whereList,
        ) as Prisma.FilterConditionWhereInput;
        const rows = await prisma.filterCondition.findMany({
          take,
          skip,
          orderBy: { filterId: "asc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "inbound_message": {
        const listSelect = {
          id: true,
          inboundAddressId: true,
          correlationId: true,
          messageIdHeader: true,
          mailFrom: true,
          rcptTo: true,
          subject: true,
          textBody: true,
          htmlBody: true,
          rawMime: true,
          headers: true,
          receivedAt: true,
          readAt: true,
          archived: true,
          gmailMessageId: true,
          outlookMessageId: true,
          hiddenFromTransferList: true,
          rulesEvaluatedAt: true,
        } as const;

        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.inboundMessage.findUnique({
            where: { id },
            select: listSelect,
          });
          if (!row) return { ok: true, data: { row: null } };
          const [safe] = truncateInboundMessageList([
            row as (typeof row & { rawMime: string }),
          ]);
          return { ok: true, data: { row: safe } };
        }

        const w = simpleWhere(
          new Set([
            "inboundAddressId",
            "archived",
            "mailFrom",
            "subject",
            "correlationId",
          ]),
          whereList,
        ) as Prisma.InboundMessageWhereInput;

        const rows = await prisma.inboundMessage.findMany({
          take,
          skip,
          orderBy:
            (orderByClause(
              new Set(["id", "receivedAt"]),
              input.orderByField,
              input.orderByDir,
            ) as Prisma.InboundMessageOrderByWithRelationInput) ??
            { receivedAt: "desc" },
          where: w,
          select: listSelect,
        });
        return {
          ok: true,
          data: {
            rows: truncateInboundMessageList(
              rows as Parameters<typeof truncateInboundMessageList>[0],
            ),
            count: rows.length,
          },
        };
      }

      case "inbound_attachment": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.inboundAttachment.findUnique({
            where: { id },
          });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["inboundMessageId"]),
          whereList,
        ) as Prisma.InboundAttachmentWhereInput;
        const rows = await prisma.inboundAttachment.findMany({
          take,
          skip,
          orderBy: { id: "asc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "rule": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.rule.findUnique({
            where: { id },
            include: { conditions: true, actions: true },
          });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["name", "enabled", "inboundAddressId", "automationId"]),
          whereList,
        ) as Prisma.RuleWhereInput;
        const rows = await prisma.rule.findMany({
          take,
          skip,
          orderBy: { priority: "asc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "rule_condition": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.ruleCondition.findUnique({ where: { id } });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["ruleId"]),
          whereList,
        ) as Prisma.RuleConditionWhereInput;
        const rows = await prisma.ruleCondition.findMany({
          take,
          skip,
          orderBy: { ruleId: "asc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "rule_action": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.ruleAction.findUnique({ where: { id } });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["ruleId", "type"]),
          whereList,
        ) as Prisma.RuleActionWhereInput;
        const rows = await prisma.ruleAction.findMany({
          take,
          skip,
          orderBy: { ruleId: "asc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "message_action_log": {
        if (op === "get") {
          const id = parseId(input.id);
          if (id === null)
            return { ok: false, error: "db_read get requires id (positive integer)." };
          const row = await prisma.messageActionLog.findUnique({
            where: { id },
          });
          return { ok: true, data: { row } };
        }
        const w = simpleWhere(
          new Set(["inboundMessageId", "ruleId", "status"]),
          whereList,
        ) as Prisma.MessageActionLogWhereInput;
        const rows = await prisma.messageActionLog.findMany({
          take,
          skip,
          orderBy: { createdAt: "desc" },
          where: w,
        });
        return { ok: true, data: { rows, count: rows.length } };
      }

      case "app_mailbox_settings": {
        const row = await prisma.appMailboxSettings.findUnique({
          where: { id: 1 },
        });
        return { ok: true, data: { row } };
      }

      case "outlook_oauth_settings": {
        const row = await prisma.outlookOAuthSettings.findUnique({
          where: { id: 1 },
        });
        return {
          ok: true,
          data: { row: row ? redactOAuth({ ...row }) : null },
        };
      }

      case "smtp_outbound_settings": {
        const row = await prisma.smtpOutboundSettings.findUnique({
          where: { id: 1 },
        });
        if (!row) return { ok: true, data: { row: null } };
        const { authPassword: _a, ...rest } = row;
        return {
          ok: true,
          data: {
            row: { ...rest, authPassword: row.authPassword ? "[redacted]" : null },
          },
        };
      }

      case "ollama_settings": {
        const row = await prisma.ollamaSettings.findUnique({ where: { id: 1 } });
        if (!row) return { ok: true, data: { row: null } };
        return {
          ok: true,
          data: {
            row: {
              ...row,
              apiKey: row.apiKey ? "[redacted]" : null,
            },
          },
        };
      }

      case "google_oauth_settings": {
        const row = await prisma.googleOAuthSettings.findUnique({
          where: { id: 1 },
        });
        return {
          ok: true,
          data: { row: row ? redactOAuth({ ...row }) : null },
        };
      }

      default:
        return { ok: false, error: `Entity not implemented: ${key}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur Prisma.";
    return { ok: false, error: msg.slice(0, 400) };
  }
}

function parseId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 1 ? n : null;
  }
  if (typeof v === "string" && /^[1-9]\d*$/.test(v.trim())) {
    return parseInt(v.trim(), 10);
  }
  return null;
}
