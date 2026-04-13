export type ToolRisk = "read" | "write" | "delete";

export type ToolDefinition = {
  name: string;
  summary: string;
  /** Argument description for the system prompt and assistant_help. */
  parameters: string;
  adminOnly: boolean;
  risk: ToolRisk;
};

/**
 * Single source of truth: tool names, permissions, and text injected into the system prompt.
 * Implementations live in tool-executor (no separate public HTTP executor route).
 */
export const ASSISTANT_TOOL_REGISTRY: ToolDefinition[] = [
  {
    name: "assistant_help",
    summary:
      "Returns the catalog of tools available for this account (like a help command).",
    parameters: "No arguments.",
    adminOnly: false,
    risk: "read",
  },
  {
    name: "db_list_entities",
    summary:
      "Lists all Prisma tables / entities exposed for read access (key, description, adminOnly).",
    parameters:
      "No arguments. Call before db_read to discover valid entity keys.",
    adminOnly: false,
    risk: "read",
  },
  {
    name: "db_read",
    summary:
      "Generic read on one entity (list or single row by id): access to everything listed in the catalog.",
    parameters:
      "entity (string, e.g. inbound_message), operation: list | get, optional: id (for get), take (1–75), skip, orderByField, orderByDir (asc|desc), where: array of { field, op: eq|contains, value } on fields allowed for that entity.",
    adminOnly: false,
    risk: "read",
  },
  {
    name: "search_inbox",
    summary:
      "Search inbox messages (same rules as the reception / inbox UI).",
    parameters:
      "At least one of: textContains, fromContains, subjectContains (strings). optional: limit (1–25).",
    adminOnly: false,
    risk: "read",
  },
  {
    name: "get_inbox_message",
    summary: "Read one inbox message details (body text, subject, sender).",
    parameters: "id (integer message id).",
    adminOnly: false,
    risk: "read",
  },
  {
    name: "navigate_app",
    summary:
      "Ask the client to open a page (message list or message detail).",
    parameters:
      'path: "/boite" or "/boite/ID" where ID is the exact inbound_message.id from a prior tool (search_inbox / get_inbox_message / db_read). Do not invent IDs.',
    adminOnly: false,
    risk: "read",
  },
  {
    name: "list_app_users",
    summary: "List application user accounts (summary).",
    parameters: "No arguments. Admin only.",
    adminOnly: true,
    risk: "read",
  },
  {
    name: "request_archive_inbox_message",
    summary:
      "Prepare archiving a message: no immediate write; the human must confirm in the UI.",
    parameters: "id (integer, message to archive).",
    adminOnly: false,
    risk: "write",
  },
];

export function toolDefinition(name: string): ToolDefinition | undefined {
  return ASSISTANT_TOOL_REGISTRY.find((t) => t.name === name);
}

export function toolAllowedForUser(name: string, isAdmin: boolean): boolean {
  const def = toolDefinition(name);
  if (!def) return false;
  if (def.adminOnly && !isAdmin) return false;
  return true;
}

export function toolsPromptSection(isAdmin: boolean): string {
  let i = 0;
  const lines: string[] = [];
  for (const t of ASSISTANT_TOOL_REGISTRY) {
    if (t.adminOnly && !isAdmin) continue;
    i += 1;
    const badge =
      t.risk === "read"
        ? "read"
        : t.risk === "write"
          ? "write"
          : "delete";
    lines.push(
      `${i}) **${t.name}** (${badge}${t.adminOnly ? ", admin" : ""}) — ${t.summary}\n   ${t.parameters}`,
    );
  }
  return lines.join("\n\n");
}

export function toolsCatalogForHelp(isAdmin: boolean): ToolDefinition[] {
  return ASSISTANT_TOOL_REGISTRY.filter((t) => !t.adminOnly || isAdmin);
}
