import { NextResponse } from "next/server";
import { normalizeAgentChatMessages } from "@/lib/assistant/agent-messages";
import { runAssistantAgentLoop } from "@/lib/assistant/agent-loop";
import { assistantRequestOriginError } from "@/lib/assistant/request-guard";
import { getSessionUser } from "@/lib/auth";
import { getOllamaConfig } from "@/lib/ollama/ollama-config";

/**
 * Assistant avec outils (BDD métier via handlers serveur). Réponse JSON, pas de stream.
 * Les outils ne sont pas exposés sur une route séparée : exécution interne à cette requête.
 */
export async function POST(request: Request) {
  const originErr = assistantRequestOriginError(request);
  if (originErr) {
    return NextResponse.json({ error: originErr }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const cfg = await getOllamaConfig();
  if (!cfg?.model) {
    return NextResponse.json(
      { error: "Ollama non configure ou modele absent." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("messages" in body)) {
    return NextResponse.json({ error: "messages[] requis." }, { status: 400 });
  }

  const messages = normalizeAgentChatMessages(
    (body as { messages: unknown }).messages,
  );
  if (!messages) {
    return NextResponse.json(
      { error: "messages[] invalide ou trop volumineux." },
      { status: 400 },
    );
  }

  const ac = request.signal;

  try {
    const { segments, reply, navigation, pendingMutation } =
      await runAssistantAgentLoop(cfg, messages, ac, {
        userId: user.id,
        isAdmin: user.isAdmin,
      });
    return NextResponse.json({
      segments,
      reply,
      navigation,
      pendingMutation,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "Annule." }, { status: 499 });
    }
    const msg = e instanceof Error ? e.message : "Erreur inconnue.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
