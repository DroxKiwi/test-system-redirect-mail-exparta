import { prisma } from "@/lib/db/prisma";

export type ResolvedOllamaConfig = {
  baseUrl: string;
  apiKey: string | null;
  /** Modèle choisi dans les réglages (peut être vide). */
  model: string;
};

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Configuration Ollama persistée (singleton id = 1). Retourne null si l’URL de base est vide.
 */
export async function getOllamaConfig(): Promise<ResolvedOllamaConfig | null> {
  const row = await prisma.ollamaSettings.findUnique({
    where: { id: 1 },
  });
  if (!row) {
    return null;
  }
  const baseUrl = normalizeBaseUrl(row.baseUrl);
  if (!baseUrl) {
    return null;
  }
  const key = row.apiKey?.trim();
  return {
    baseUrl,
    apiKey: key && key.length > 0 ? key : null,
    model: row.model?.trim() ?? "",
  };
}
