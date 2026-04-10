import { prisma } from "@/lib/prisma";

export type ResolvedOutboundSmtp = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  source: "database" | "environment";
};

/**
 * Configuration active : ligne BDD (id=1) si `host` non vide, sinon variables d'environnement.
 */
export async function getOutboundSmtpConfig(): Promise<ResolvedOutboundSmtp | null> {
  const row = await prisma.smtpOutboundSettings.findUnique({
    where: { id: 1 },
  });

  const dbHost = row?.host?.trim() ?? "";
  if (dbHost) {
    const from = row!.fromAddress.trim();
    if (!from) {
      return null;
    }
    return {
      host: dbHost,
      port: row!.port,
      secure: row!.secure,
      user: row!.authUser?.trim() || undefined,
      pass: row!.authPassword?.trim() || undefined,
      from,
      source: "database",
    };
  }

  const host = process.env.SMTP_OUTBOUND_HOST?.trim();
  if (!host) {
    return null;
  }

  const from = process.env.SMTP_OUTBOUND_FROM?.trim();
  if (!from) {
    return null;
  }

  return {
    host,
    port: Number.parseInt(process.env.SMTP_OUTBOUND_PORT ?? "587", 10),
    secure: process.env.SMTP_OUTBOUND_SECURE === "true",
    user: process.env.SMTP_OUTBOUND_USER?.trim() || undefined,
    pass: process.env.SMTP_OUTBOUND_PASS?.trim() || undefined,
    from,
    source: "environment",
  };
}
