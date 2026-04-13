/**
 * Métadonnées des entités exposées à l’assistant (lecture seule, requêtes paramétrées).
 * Clés stables utilisées dans db_read.entity.
 */
export type DbEntityCatalogEntry = {
  key: string;
  description: string;
  /** Si true : réservé aux comptes isAdmin. */
  adminOnly: boolean;
};

export const DB_ENTITY_CATALOG: DbEntityCatalogEntry[] = [
  {
    key: "user",
    description:
      "Application accounts (password and session token never returned).",
    adminOnly: true,
  },
  {
    key: "transfer_shortcut",
    description: "Transfer shortcuts (target emails).",
    adminOnly: true,
  },
  {
    key: "mail_flow_event",
    description: "Mail pipeline event log (SMTP / worker).",
    adminOnly: false,
  },
  {
    key: "inbound_address",
    description: "Inbound SMTP addresses.",
    adminOnly: false,
  },
  {
    key: "filter",
    description: "Reusable filters (automations).",
    adminOnly: false,
  },
  {
    key: "automation",
    description: "Automations (links to rules).",
    adminOnly: false,
  },
  {
    key: "automation_on_filter",
    description: "Automation ↔ filter links.",
    adminOnly: false,
  },
  {
    key: "filter_condition",
    description: "Conditions for a filter.",
    adminOnly: false,
  },
  {
    key: "inbound_message",
    description:
      "Received messages (list omits raw MIME; text body truncated in list views).",
    adminOnly: false,
  },
  {
    key: "inbound_attachment",
    description: "Attachments (metadata).",
    adminOnly: false,
  },
  {
    key: "rule",
    description: "Mail processing rules.",
    adminOnly: false,
  },
  {
    key: "rule_condition",
    description: "Conditions for a rule.",
    adminOnly: false,
  },
  {
    key: "rule_action",
    description: "Actions for a rule.",
    adminOnly: false,
  },
  {
    key: "message_action_log",
    description: "Log of actions on messages.",
    adminOnly: false,
  },
  {
    key: "app_mailbox_settings",
    description: "Active cloud mailbox setting (singleton).",
    adminOnly: true,
  },
  {
    key: "outlook_oauth_settings",
    description: "Outlook OAuth settings (secrets redacted).",
    adminOnly: true,
  },
  {
    key: "smtp_outbound_settings",
    description: "Outbound SMTP (password redacted).",
    adminOnly: true,
  },
  {
    key: "ollama_settings",
    description: "Ollama connection (API key redacted).",
    adminOnly: true,
  },
  {
    key: "google_oauth_settings",
    description: "Google OAuth settings (secrets redacted).",
    adminOnly: true,
  },
];

export function catalogEntryForEntity(
  key: string,
): DbEntityCatalogEntry | undefined {
  return DB_ENTITY_CATALOG.find((e) => e.key === key.trim().toLowerCase());
}

export function entityAllowedForSession(
  key: string,
  isAdmin: boolean,
): boolean {
  const e = catalogEntryForEntity(key);
  if (!e) return false;
  if (e.adminOnly && !isAdmin) return false;
  return true;
}
