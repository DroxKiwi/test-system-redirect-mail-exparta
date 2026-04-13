/**
 * Paramètres de génération pour l’assistant (requête Ollama `POST /api/chat`, clé `options`).
 * Tout ajuster ici : désactiver d’un coup avec `enabled: false`.
 */
export const OLLAMA_ASSISTANT_GENERATION = {
  /** `false` : n’envoie pas `options` → Ollama utilise ses défauts pour le modèle. */
  enabled: true,
  temperature: 1.0,
  top_p: 0.95,
  top_k: 64,
};

/** Objet à fusionner dans le corps JSON sous `options`, ou `undefined` si désactivé. */
export function ollamaAssistantGenerationOptions():
  | { temperature: number; top_p: number; top_k: number }
  | undefined {
  if (!OLLAMA_ASSISTANT_GENERATION.enabled) return undefined;
  return {
    temperature: OLLAMA_ASSISTANT_GENERATION.temperature,
    top_p: OLLAMA_ASSISTANT_GENERATION.top_p,
    top_k: OLLAMA_ASSISTANT_GENERATION.top_k,
  };
}
