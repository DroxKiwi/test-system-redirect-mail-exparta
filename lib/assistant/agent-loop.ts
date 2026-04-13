import type { AgentChatMessage } from "@/lib/assistant/agent-messages";
import { buildAgentSystemPrompt } from "@/lib/assistant/agent-system-prompt";
import {
  toolTagDisplayMeta,
  type ToolTagPalette,
} from "@/lib/assistant/tool-display";
import type { AssistantSessionContext } from "@/lib/assistant/session-types";
import {
  executeAssistantTool,
  type PendingMutationNotice,
} from "@/lib/assistant/tool-executor";
import {
  ASSISTANT_THINKING_ONLY_BRIDGE_FR,
  FALLBACK_EMPTY_ASSISTANT_REPLY_FR,
} from "@/lib/assistant/fallback-copy";
import { ollamaAssistantGenerationOptions } from "@/lib/assistant/ollama-assistant-generation";
import type { ResolvedOllamaConfig } from "@/lib/ollama/ollama-config";

export type AgentUiSegment =
  | {
      type: "tool";
      tool: string;
      label: string;
      ok: boolean;
      palette: ToolTagPalette;
    }
  | { type: "thinking"; content: string }
  | { type: "text"; content: string };

export type { AgentChatMessage };

type ToolCallsPayload = {
  tool_calls: Array<{ name: string; arguments: unknown }>;
};

const MAX_ITERATIONS = 8;

const TOOL_FOLLOWUP_HINT =
  "Instructions: reply to the user in **French** with at least one clear sentence. If a tool failed (ok:false in the JSON), explain the error or limitation in French. After a successful navigate_app, confirm in French that the page was opened. Never return an empty or whitespace-only reply. If the user’s question is about mail (sender, latest message, subject, body) and you still lack data, call search_inbox or db_read (entity inbound_message, orderByField receivedAt, orderByDir desc, take 1 or 5) before concluding.";

/** Thinking models may leave `content` empty unless we disable thinking on the wire. */
const EMPTY_MODEL_RETRY_NUDGE =
  "[System] Your last reply was empty. Output EITHER only valid JSON: {\"tool_calls\":[{\"name\":\"…\",\"arguments\":{…}}]} with no other text, OR at least one helpful sentence in French. For mail/sender questions, call search_inbox or db_read on inbound_message first.";

function finalizeReply(reply: string, navigation: string | null): string {
  const t = reply.trim();
  if (t.length > 0) return t;
  if (navigation) {
    return `J’ai ouvert la page ${navigation} dans l’application. Tu peux y lire le message en entier.`;
  }
  return FALLBACK_EMPTY_ASSISTANT_REPLY_FR;
}

/** Corps principal du modèle vide mais trace thinking affichée → message ciblé (pas le gros fallback). */
function finalizeReplyWithThinkingAwareness(
  bodyRaw: string,
  hadThinkingUi: boolean,
  navigation: string | null,
): string {
  const body = bodyRaw.trim();
  if (body.length > 0) return finalizeReply(body, navigation);
  if (navigation) return finalizeReply("", navigation);
  if (hadThinkingUi) return ASSISTANT_THINKING_ONLY_BRIDGE_FR;
  return finalizeReply("", navigation);
}

const MAX_TOOL_RESULTS_MESSAGE_CHARS = 72_000;

function jsonStringifyToolSummary(toolName: string, payload: unknown): string {
  try {
    return JSON.stringify(
      payload,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      0,
    );
  } catch {
    return JSON.stringify({
      tool: toolName,
      ok: false,
      error: "Tool result could not be serialized (cycle or unsupported value).",
    });
  }
}

function truncateToolFollowupUserMessage(content: string): string {
  if (content.length <= MAX_TOOL_RESULTS_MESSAGE_CHARS) return content;
  return (
    content.slice(0, MAX_TOOL_RESULTS_MESSAGE_CHARS) +
    "\n\n[… tool results truncated for context limit; call fewer tools or narrow db_read take …]"
  );
}

function extractToolCalls(content: string): ToolCallsPayload | null {
  const trimmed = content.trim();
  const tryParse = (s: string): ToolCallsPayload | null => {
    try {
      const j = JSON.parse(s) as unknown;
      if (
        typeof j === "object" &&
        j !== null &&
        Array.isArray((j as ToolCallsPayload).tool_calls)
      ) {
        const tc = (j as ToolCallsPayload).tool_calls;
        if (
          tc.every(
            (x) =>
              typeof x === "object" &&
              x !== null &&
              typeof (x as { name?: unknown }).name === "string",
          )
        ) {
          return j as ToolCallsPayload;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const inner = tryParse(fence[1].trim());
    if (inner) return inner;
  }

  const obj = trimmed.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
  if (obj) {
    return tryParse(obj[0]);
  }

  return null;
}

function parseToolArgumentsField(raw: unknown): unknown {
  if (raw === null || raw === undefined) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return {};
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Ollama native tool_calls: [{ function: { name, arguments } }].
 * We normalize to the same shape as JSON-in-content tool_calls.
 */
function extractNativeOllamaToolCalls(msg: unknown): ToolCallsPayload | null {
  if (!msg || typeof msg !== "object") return null;
  const tc = (msg as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(tc) || tc.length === 0) return null;
  const out: { name: string; arguments: unknown }[] = [];
  for (const item of tc) {
    if (!item || typeof item !== "object") continue;
    const fn = (item as { function?: unknown }).function;
    if (!fn || typeof fn !== "object") continue;
    const name = (fn as { name?: unknown }).name;
    if (typeof name !== "string" || !name.trim()) continue;
    out.push({
      name: name.trim(),
      arguments: parseToolArgumentsField((fn as { arguments?: unknown }).arguments),
    });
  }
  return out.length > 0 ? { tool_calls: out } : null;
}

function resolveToolCallsPayload(
  content: string,
  apiMessage: unknown,
): ToolCallsPayload | null {
  const native = extractNativeOllamaToolCalls(apiMessage);
  if (native?.tool_calls?.length) return native;
  return extractToolCalls(content);
}

const MAX_THINKING_CHARS = 16_000;

/** Trace affichée à part (police plus légère côté client) ; non renvoyée comme « réponse » principale. */
function thinkingTraceText(raw: Record<string, unknown>): string {
  const t = raw.thinking;
  if (typeof t === "string" && t.trim().length > 0) return t.trim();
  const r = raw.reasoning;
  if (typeof r === "string" && r.trim().length > 0) return r.trim();
  return "";
}

function clipThinkingForUi(text: string): string {
  if (text.length <= MAX_THINKING_CHARS) return text;
  return `${text.slice(0, MAX_THINKING_CHARS)}\n\n[… tronqué pour l’affichage …]`;
}

/** Texte principal : uniquement `content` (pas la trace thinking). */
function replyBodyFromMessage(raw: Record<string, unknown>): string {
  const c = raw.content;
  return typeof c === "string" ? c : "";
}

/**
 * La manche est exploitable si outils, ou texte de réponse, ou trace thinking
 * (évite une double tentative inutile quand seul thinking est rempli).
 */
function turnHasUsableModelOutput(
  content: string,
  raw: Record<string, unknown>,
  payload: ToolCallsPayload | null,
  calls: { name: string }[],
): boolean {
  if (payload && calls.length > 0) return true;
  if (content.trim().length > 0) return true;
  return thinkingTraceText(raw).length > 0;
}

function assistantTurnForHistory(
  content: string,
  payload: ToolCallsPayload,
): string {
  const t = content.trim();
  if (t.length > 0) return t;
  return JSON.stringify({
    tool_calls: payload.tool_calls.map((x) => ({
      name: x.name,
      arguments: x.arguments ?? {},
    })),
  });
}

type OllamaAssistantTurn = {
  content: string;
  raw: Record<string, unknown>;
};

async function ollamaChatOnce(
  cfg: ResolvedOllamaConfig,
  messages: AgentChatMessage[],
  signal: AbortSignal | undefined,
): Promise<OllamaAssistantTurn> {
  const url = `${cfg.baseUrl}/api/chat`;
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  if (cfg.apiKey) {
    headers.set("X-API-Key", cfg.apiKey);
  }

  const genOpts = ollamaAssistantGenerationOptions();
  const withOptions = (extra: Record<string, unknown>) =>
    genOpts ? { ...extra, options: genOpts } : extra;

  const baseBody = withOptions({
    model: cfg.model,
    messages,
    stream: false,
    /** Modèles compatibles : `message.thinking` + `content` (thinking affiché à part dans l’UI). */
    think: true,
  });

  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(baseBody),
    cache: "no-store",
    signal,
  });

  if (!res.ok && res.status === 400) {
    const errText = await res.text().catch(() => "");
    if (/think/i.test(errText)) {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(
          withOptions({
            model: cfg.model,
            messages,
            stream: false,
          }),
        ),
        cache: "no-store",
        signal,
      });
    } else {
      throw new Error(
        errText.trim().slice(0, 400) || `Ollama returned HTTP 400.`,
      );
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text.trim().slice(0, 400) || `Ollama returned HTTP ${res.status}.`,
    );
  }

  const data = (await res.json()) as { message?: unknown };
  const msg = data.message;
  if (!msg || typeof msg !== "object") {
    throw new Error("Ollama response had no message object.");
  }
  const raw = msg as Record<string, unknown>;
  const contentField = raw.content;
  const content = typeof contentField === "string" ? contentField : "";
  return { content, raw };
}

export type AgentRunResult = {
  /** Ordre d’affichage : pastilles d’outils puis un ou plusieurs blocs texte. */
  segments: AgentUiSegment[];
  reply: string;
  navigation: string | null;
  pendingMutation: PendingMutationNotice | null;
};

export async function runAssistantAgentLoop(
  cfg: ResolvedOllamaConfig,
  conversation: AgentChatMessage[],
  signal: AbortSignal | undefined,
  session: AssistantSessionContext,
): Promise<AgentRunResult> {
  const messages: AgentChatMessage[] = [
    { role: "system", content: buildAgentSystemPrompt(session.isAdmin) },
    ...conversation.filter((m) => m.role !== "system"),
  ];

  let lastNavigation: string | null = null;
  let lastPendingMutation: PendingMutationNotice | null = null;
  const segments: AgentUiSegment[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let assistantContent = "";
    let rawAssistant: Record<string, unknown> = {};

    for (let attempt = 0; attempt < 2; attempt++) {
      const turn = await ollamaChatOnce(cfg, messages, signal);
      assistantContent = turn.content;
      rawAssistant = turn.raw;
      const payloadTry = resolveToolCallsPayload(assistantContent, rawAssistant);
      const callsTry =
        payloadTry?.tool_calls?.filter(
          (c) => typeof c.name === "string" && c.name.trim().length > 0,
        ) ?? [];
      if (
        turnHasUsableModelOutput(
          assistantContent,
          rawAssistant,
          payloadTry,
          callsTry,
        )
      ) {
        break;
      }
      if (attempt === 0) {
        messages.push({ role: "user", content: EMPTY_MODEL_RETRY_NUDGE });
      }
    }

    const payload = resolveToolCallsPayload(assistantContent, rawAssistant);

    const calls =
      payload?.tool_calls?.filter((c) => typeof c.name === "string" && c.name.trim().length > 0) ??
      [];

    const thinkUi = thinkingTraceText(rawAssistant);
    if (thinkUi.length > 0) {
      segments.push({
        type: "thinking",
        content: clipThinkingForUi(thinkUi),
      });
    }

    if (!payload || calls.length === 0) {
      const text = finalizeReplyWithThinkingAwareness(
        replyBodyFromMessage(rawAssistant),
        thinkUi.length > 0,
        lastNavigation,
      );
      segments.push({ type: "text", content: text });
      return {
        segments,
        reply: text,
        navigation: lastNavigation,
        pendingMutation: lastPendingMutation,
      };
    }

    messages.push({
      role: "assistant",
      content: assistantTurnForHistory(assistantContent, payload),
    });

    const summaries: string[] = [];
    for (const call of calls) {
      const name = call.name.trim();
      const meta = toolTagDisplayMeta(name);
      const result = await executeAssistantTool(
        name,
        call.arguments ?? {},
        session,
      );
      segments.push({
        type: "tool",
        tool: name,
        label: meta.label,
        ok: result.ok,
        palette: meta.palette,
      });
      if (result.navigation) {
        lastNavigation = result.navigation;
      }
      if (result.ok && result.pendingMutation) {
        lastPendingMutation = result.pendingMutation;
      }
      summaries.push(
        jsonStringifyToolSummary(
          name,
          result.ok
            ? { tool: name, ok: true, result: result.data }
            : { tool: name, ok: false, error: result.error },
        ),
      );
    }

    messages.push({
      role: "user",
      content: truncateToolFollowupUserMessage(
        `Tool results (JSON):\n${summaries.join("\n")}\n\n${TOOL_FOLLOWUP_HINT}`,
      ),
    });
  }

  const text = finalizeReply(
    "Étape limite d’outils atteinte. Reformule en une question plus simple, ou demande « quels outils » / « dernier mail » pour que j’utilise search_inbox ou db_read.",
    lastNavigation,
  );
  segments.push({ type: "text", content: text });
  return {
    segments,
    reply: text,
    navigation: lastNavigation,
    pendingMutation: lastPendingMutation,
  };
}
