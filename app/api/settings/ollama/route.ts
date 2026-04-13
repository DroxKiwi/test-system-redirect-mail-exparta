import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const row = await prisma.ollamaSettings.findUnique({
    where: { id: 1 },
  });

  if (!row) {
    return NextResponse.json({
      baseUrl: "",
      hasApiKey: false,
      model: "",
    });
  }

  return NextResponse.json({
    baseUrl: row.baseUrl,
    hasApiKey: Boolean(row.apiKey?.trim()),
    model: row.model ?? "",
  });
}

export async function PUT(request: Request) {
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

  if (!("baseUrl" in b) || typeof b.baseUrl !== "string") {
    return NextResponse.json({ error: "Champ baseUrl requis." }, { status: 400 });
  }

  const baseUrl = b.baseUrl.trim();
  if (baseUrl && !isValidHttpUrl(baseUrl)) {
    return NextResponse.json(
      { error: "URL invalide (http ou https attendu)." },
      { status: 400 },
    );
  }

  let nextApiKey: string | null | undefined;
  if ("apiKey" in b) {
    if (b.apiKey === null || b.apiKey === "") {
      nextApiKey = null;
    } else if (typeof b.apiKey === "string") {
      const k = b.apiKey.trim();
      nextApiKey = k.length > 0 ? k : null;
    } else {
      return NextResponse.json({ error: "apiKey invalide." }, { status: 400 });
    }
  }

  let nextModel: string | undefined;
  if ("model" in b) {
    if (typeof b.model !== "string") {
      return NextResponse.json({ error: "model invalide." }, { status: 400 });
    }
    nextModel = b.model.trim();
  }

  const updateData: Prisma.OllamaSettingsUpdateInput = { baseUrl };
  if (nextApiKey !== undefined) {
    updateData.apiKey = nextApiKey;
  }
  if (nextModel !== undefined) {
    updateData.model = nextModel;
  }

  await prisma.ollamaSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      baseUrl,
      apiKey: nextApiKey === undefined ? null : nextApiKey,
      model: nextModel ?? "",
    },
    update: updateData,
  });

  return NextResponse.json({ ok: true });
}
