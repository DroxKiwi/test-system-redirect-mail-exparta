import { normalizeAndValidateNavigationPath } from "@/lib/assistant/allowed-paths";
import { inboundMessageExistsForBoiteDetail } from "@/lib/boite/boite-messages";
import {
  requestArchiveInboxMessage,
} from "@/lib/assistant/archive-inbox-request";
import {
  dbListEntitiesForSession,
  executeDbRead,
} from "@/lib/assistant/db-read/execute";
import { getInboxMessageForAgent } from "@/lib/assistant/get-inbox-message";
import { listAppUsersForAgent } from "@/lib/assistant/list-users-for-agent";
import { searchInboxMessagesForAgent } from "@/lib/assistant/search-inbox-messages";
import type { AssistantSessionContext } from "@/lib/assistant/session-types";
import {
  toolAllowedForUser,
  toolDefinition,
  toolsCatalogForHelp,
} from "@/lib/assistant/tools/registry";

export type { AssistantSessionContext };

export type PendingMutationNotice = {
  token: string;
  summary: string;
  kind: "archive_inbox_message";
};

export type ToolExecutionResult =
  | {
      ok: true;
      data: unknown;
      navigation: string | null;
      pendingMutation?: PendingMutationNotice;
    }
  | { ok: false; error: string; navigation: null };

function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asOptionalString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function asOptionalLimit(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.trunc(v);
}

function asMessageId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.trunc(v);
    return n >= 1 ? n : null;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (/^[1-9]\d*$/.test(t)) return parseInt(t, 10);
  }
  return null;
}

export async function executeAssistantTool(
  name: string,
  args: unknown,
  ctx: AssistantSessionContext,
): Promise<ToolExecutionResult> {
  const trimmed = name.trim();
  if (!toolAllowedForUser(trimmed, ctx.isAdmin)) {
    const def = toolDefinition(trimmed);
    if (def?.adminOnly && !ctx.isAdmin) {
      return {
        ok: false,
        error: "Tool reserved for administrators.",
        navigation: null,
      };
    }
    return {
      ok: false,
      error: `Unknown or disallowed tool: ${trimmed}`,
      navigation: null,
    };
  }

  switch (trimmed) {
    case "db_list_entities": {
      return {
        ok: true,
        data: dbListEntitiesForSession(ctx.isAdmin),
        navigation: null,
      };
    }
    case "db_read": {
      const o = asRecord(args) ?? {};
      const entity = typeof o.entity === "string" ? o.entity : "";
      const operation =
        typeof o.operation === "string" ? o.operation : "list";
      const r = await executeDbRead(
        {
          entity,
          operation,
          id: o.id,
          take: o.take,
          skip: o.skip,
          orderByField: o.orderByField,
          orderByDir: o.orderByDir,
          where: o.where,
        },
        ctx,
      );
      if (!r.ok) {
        return { ok: false, error: r.error, navigation: null };
      }
      return { ok: true, data: r.data, navigation: null };
    }
    case "assistant_help": {
      const tools = toolsCatalogForHelp(ctx.isAdmin).map((t) => ({
        name: t.name,
        risk: t.risk,
        adminOnly: t.adminOnly,
        summary: t.summary,
        parameters: t.parameters,
      }));
      return {
        ok: true,
        data: {
          tools,
          note: "Use these exact names in tool_calls[].name.",
        },
        navigation: null,
      };
    }
    case "search_inbox": {
      const o = asRecord(args) ?? {};
      const r = await searchInboxMessagesForAgent({
        textContains: asOptionalString(o.textContains),
        fromContains: asOptionalString(o.fromContains),
        subjectContains: asOptionalString(o.subjectContains),
        limit: asOptionalLimit(o.limit),
      });
      return { ok: true, data: r, navigation: null };
    }
    case "navigate_app": {
      const o = asRecord(args) ?? {};
      const pathRaw = o.path;
      if (typeof pathRaw !== "string") {
        return {
          ok: false,
          error: "navigate_app requires path (string).",
          navigation: null,
        };
      }
      const path = normalizeAndValidateNavigationPath(pathRaw);
      if (!path) {
        return {
          ok: false,
          error: `Path not allowed: ${pathRaw.slice(0, 120)}`,
          navigation: null,
        };
      }
      const boiteDetail = /^\/boite\/([1-9]\d*)$/.exec(path);
      if (boiteDetail) {
        const messageId = Number.parseInt(boiteDetail[1], 10);
        const exists = await inboundMessageExistsForBoiteDetail(messageId);
        if (!exists) {
          return {
            ok: false,
            error: `No openable message at /boite/${messageId} (unknown id or inactive address). Use only the numeric id from search_inbox, get_inbox_message, or db_read on inbound_message — never invent an id (e.g. 1 for "first").`,
            navigation: null,
          };
        }
      }
      return {
        ok: true,
        data: { opened: path },
        navigation: path,
      };
    }
    case "get_inbox_message": {
      const o = asRecord(args) ?? {};
      const id = asMessageId(o.id);
      if (id === null) {
        return {
          ok: false,
          error:
            "get_inbox_message requires id (positive integer, message identifier).",
          navigation: null,
        };
      }
      const r = await getInboxMessageForAgent(id);
      if (!r.ok) {
        return { ok: false, error: r.error, navigation: null };
      }
      return { ok: true, data: r.message, navigation: null };
    }
    case "list_app_users": {
      const users = await listAppUsersForAgent();
      return { ok: true, data: { users, count: users.length }, navigation: null };
    }
    case "request_archive_inbox_message": {
      const o = asRecord(args) ?? {};
      const id = asMessageId(o.id);
      if (id === null) {
        return {
          ok: false,
          error: "request_archive_inbox_message requires id (message).",
          navigation: null,
        };
      }
      const r = await requestArchiveInboxMessage({
        userId: ctx.userId,
        messageId: id,
      });
      if (!r.ok) {
        return { ok: false, error: r.error, navigation: null };
      }
      return {
        ok: true,
        data: {
          mustConfirm: r.mustConfirm,
          expiresInMinutes: r.expiresInMinutes,
          summary: r.summary,
          instruction:
            "The user must click « Confirmer » in the assistant panel to apply the archive.",
        },
        navigation: null,
        pendingMutation: {
          token: r.token,
          summary: r.summary,
          kind: "archive_inbox_message",
        },
      };
    }
    default:
      return {
        ok: false,
        error: `Unknown tool: ${trimmed}`,
        navigation: null,
      };
  }
}
