import type { Prisma } from "@prisma/client";
import {
  ActionLogStatus,
  type Rule,
  type RuleAction,
  type RuleCondition,
} from "@prisma/client";
import { mailFlowLogSafe } from "@/lib/mail-flow-log";
import { prisma } from "@/lib/prisma";
import { evaluateCondition } from "./conditions";
import type { ParsedInboundMime } from "./mime";
import { sendForwardMail } from "./smtp-send";

type RuleLoaded = Rule & {
  conditions: RuleCondition[];
  actions: RuleAction[];
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function logAction(
  inboundMessageId: number,
  ruleId: number,
  actionId: number | null,
  status: ActionLogStatus,
  detail?: Prisma.InputJsonValue
) {
  await prisma.messageActionLog.create({
    data: {
      inboundMessageId,
      ruleId,
      actionId,
      status,
      detail: detail ?? undefined,
    },
  });
}

function applyRewriteSubject(
  current: string,
  cfg: Record<string, unknown>
): string {
  const mode = cfg.mode;
  if (mode === "prefix") {
    const prefix = typeof cfg.prefix === "string" ? cfg.prefix : "";
    return prefix + current;
  }
  if (mode === "replace") {
    const subject = typeof cfg.subject === "string" ? cfg.subject : "";
    return subject;
  }
  return current;
}

export async function processInboundForAddress(input: {
  inboundAddressId: number;
  mailFrom: string;
  rcptTo: string[];
  rawMime: string;
  parsed: ParsedInboundMime;
  correlationId: string;
}): Promise<{ inboundMessageId: number }> {
  const {
    inboundAddressId,
    mailFrom,
    rcptTo,
    rawMime,
    parsed,
    correlationId,
  } = input;

  const message = await prisma.inboundMessage.create({
    data: {
      inboundAddressId,
      correlationId,
      messageIdHeader: parsed.messageIdHeader,
      mailFrom,
      rcptTo: rcptTo as unknown as Prisma.InputJsonValue,
      subject: parsed.subject,
      rawMime,
      textBody: parsed.textBody,
      htmlBody: parsed.htmlBody,
      headers: parsed.headersJson as Prisma.InputJsonValue,
    },
  });

  if (parsed.attachments.length > 0) {
    await prisma.inboundAttachment.createMany({
      data: parsed.attachments.map((a) => ({
        inboundMessageId: message.id,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        contentId: a.contentId,
        disposition: a.disposition,
      })),
    });
  }

  await mailFlowLogSafe({
    correlationId,
    actor: "next",
    step: "inbound_message_stored",
    direction: "in",
    summary: `Message enregistre #${message.id} (adresse entree #${inboundAddressId})`,
    detail: {
      inboundMessageId: message.id,
      inboundAddressId,
      subject: parsed.subject,
    },
  });

  const rules = (await prisma.rule.findMany({
    where: {
      enabled: true,
      OR: [{ inboundAddressId: null }, { inboundAddressId }],
    },
    orderBy: { priority: "asc" },
    include: {
      conditions: true,
      actions: { orderBy: { order: "asc" } },
    },
  })) as RuleLoaded[];

  const condCtx = {
    mailFrom,
    subject: parsed.subject,
    textBody: parsed.textBody,
    htmlBody: parsed.htmlBody,
    rawMime,
    headersJson: parsed.headersJson,
  };

  for (const rule of rules) {
    const allMatch = rule.conditions.every((c: RuleCondition) =>
      evaluateCondition(c, condCtx)
    );

    if (!allMatch) {
      await logAction(message.id, rule.id, null, ActionLogStatus.SKIPPED, {
        reason: "conditions_not_met",
      });
      continue;
    }

    let workingSubject = parsed.subject ?? "";
    let workingText = parsed.textBody ?? "";
    let workingHtml: string | null = parsed.htmlBody;
    let dropped = false;

    for (const action of rule.actions) {
      if (dropped) {
        break;
      }

      const cfg =
        action.config && typeof action.config === "object"
          ? (action.config as Record<string, unknown>)
          : {};

      try {
        switch (action.type) {
          case "REWRITE_SUBJECT": {
            workingSubject = applyRewriteSubject(workingSubject, cfg);
            await logAction(
              message.id,
              rule.id,
              action.id,
              ActionLogStatus.SENT,
              { type: "REWRITE_SUBJECT" }
            );
            break;
          }
          case "PREPEND_TEXT": {
            const text = typeof cfg.text === "string" ? cfg.text : "";
            workingText = text + (workingText ? `\n\n${workingText}` : "");
            if (workingHtml) {
              workingHtml = `<div>${escapeHtml(text)}</div>${workingHtml}`;
            } else if (text) {
              workingHtml = `<div>${escapeHtml(text)}</div>`;
            }
            await logAction(
              message.id,
              rule.id,
              action.id,
              ActionLogStatus.SENT,
              { type: "PREPEND_TEXT" }
            );
            break;
          }
          case "DROP": {
            dropped = true;
            await logAction(message.id, rule.id, action.id, ActionLogStatus.SENT, {
              type: "DROP",
            });
            break;
          }
          case "FORWARD": {
            const to = typeof cfg.to === "string" ? cfg.to.trim() : "";
            if (!to) {
              await logAction(
                message.id,
                rule.id,
                action.id,
                ActionLogStatus.FAILED,
                { error: "Adresse de transfert vide" }
              );
              break;
            }
            try {
              await mailFlowLogSafe({
                correlationId,
                actor: "next",
                step: "smtp_outbound_attempt",
                direction: "out",
                summary: `Transfert sortant vers ${to} (regle #${rule.id})`,
                detail: {
                  to,
                  inboundMessageId: message.id,
                  ruleId: rule.id,
                  actionId: action.id,
                },
              });
              const sendResult = await sendForwardMail({
                to,
                subject: workingSubject,
                text: workingText || undefined,
                html: workingHtml || undefined,
                replyTo: mailFrom,
              });
              const forwardDetail: Record<string, unknown> = { type: "FORWARD", to };
              if (sendResult.channel === "gmail") {
                forwardDetail.outboundRfcMessageId = sendResult.outboundRfcMessageId;
                forwardDetail.gmailSentMessageId = sendResult.gmailSentMessageId;
              }
              await logAction(
                message.id,
                rule.id,
                action.id,
                ActionLogStatus.SENT,
                forwardDetail as Prisma.InputJsonValue
              );
              await mailFlowLogSafe({
                correlationId,
                actor: "next",
                step: "smtp_outbound_sent",
                direction: "out",
                summary: `Transfert sortant reussi vers ${to}`,
                detail: {
                  to,
                  inboundMessageId: message.id,
                  ruleId: rule.id,
                },
              });
            } catch (err) {
              const msg =
                err instanceof Error ? err.message : "Erreur envoi sortant";
              await logAction(
                message.id,
                rule.id,
                action.id,
                ActionLogStatus.FAILED,
                { type: "FORWARD", to, error: msg }
              );
              await mailFlowLogSafe({
                correlationId,
                actor: "next",
                step: "smtp_outbound_failed",
                direction: "out",
                summary: `Echec transfert sortant vers ${to}: ${msg.slice(0, 200)}`,
                detail: {
                  to,
                  inboundMessageId: message.id,
                  ruleId: rule.id,
                  error: msg,
                },
              });
            }
            break;
          }
          default:
            await logAction(
              message.id,
              rule.id,
              action.id,
              ActionLogStatus.FAILED,
              { error: `Type d action non gere: ${String(action.type)}` }
            );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logAction(message.id, rule.id, action.id, ActionLogStatus.FAILED, {
          error: msg,
        });
      }
    }

    if (rule.stopProcessing) {
      break;
    }
  }

  return { inboundMessageId: message.id };
}
