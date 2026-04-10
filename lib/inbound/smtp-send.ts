import nodemailer from "nodemailer";
import { getOutboundSmtpConfig } from "@/lib/smtp-config";

export type ForwardMailParams = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
};

/**
 * Envoie un message via SMTP (configuration BDD prioritaire, sinon .env).
 */
export async function sendForwardMail(params: ForwardMailParams): Promise<void> {
  const cfg = await getOutboundSmtpConfig();
  if (!cfg) {
    throw new Error(
      "SMTP sortant non configure (Reglages > SMTP sortant ou variables SMTP_OUTBOUND_*)"
    );
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
  });

  const to =
    Array.isArray(params.to) && params.to.length > 0
      ? params.to.join(", ")
      : typeof params.to === "string"
        ? params.to
        : "";

  await transporter.sendMail({
    from: cfg.from,
    to,
    replyTo: params.replyTo,
    subject: params.subject.trim() || "(sans sujet)",
    text: params.text?.trim() ? params.text : undefined,
    html: params.html?.trim() ? params.html : undefined,
  });
}
