import type { Attachment } from "mailparser";
import { simpleParser } from "mailparser";

export type ParsedInboundAttachment = {
  filename: string | null;
  contentType: string | null;
  sizeBytes: number;
  contentId: string | null;
  disposition: string | null;
};

export type ParsedInboundMime = {
  messageIdHeader: string | null;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  headersJson: Record<string, string>;
  attachments: ParsedInboundAttachment[];
};

function headerValueToString(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && "value" in value) {
    const v = (value as { value?: unknown }).value;
    if (typeof v === "string") {
      return v;
    }
    if (Array.isArray(v)) {
      return v.map(headerValueToString).join(", ");
    }
  }
  if (typeof value === "object" && "text" in value) {
    const t = (value as { text?: unknown }).text;
    if (typeof t === "string") {
      return t;
    }
  }
  return String(value);
}

function parseAttachmentsMeta(parsed: { attachments?: Attachment[] }): ParsedInboundAttachment[] {
  if (!Array.isArray(parsed.attachments) || parsed.attachments.length === 0) {
    return [];
  }
  const out: ParsedInboundAttachment[] = [];
  for (const a of parsed.attachments) {
    if (!a || typeof a !== "object") continue;
    const sizeFromField = typeof a.size === "number" ? a.size : 0;
    const bufLen = Buffer.isBuffer(a.content) ? a.content.length : 0;
    const sizeBytes = sizeFromField > 0 ? sizeFromField : bufLen;
    const cid =
      typeof a.contentId === "string" && a.contentId.trim()
        ? a.contentId.trim()
        : typeof a.cid === "string" && a.cid.trim()
          ? a.cid.trim()
          : null;
    out.push({
      filename: typeof a.filename === "string" && a.filename.trim() ? a.filename.trim() : null,
      contentType:
        typeof a.contentType === "string" && a.contentType.trim() ? a.contentType.trim() : null,
      sizeBytes,
      contentId: cid,
      disposition:
        typeof a.contentDisposition === "string" && a.contentDisposition.trim()
          ? a.contentDisposition.trim()
          : null,
    });
  }
  return out;
}

/**
 * Construit une carte en-tête insensible à la casse pour la lecture.
 */
export function buildHeaderLookup(headersJson: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(headersJson)) {
    map.set(k.toLowerCase(), v);
  }
  return map;
}

export async function parseInboundMime(rawMime: string): Promise<ParsedInboundMime> {
  const parsed = await simpleParser(rawMime);

  const headersJson: Record<string, string> = {};
  const h = parsed.headers;
  if (h && typeof (h as Map<string, unknown>).forEach === "function") {
    (h as Map<string, unknown>).forEach((value, key) => {
      headersJson[String(key)] = headerValueToString(value);
    });
  }

  const messageIdHeader =
    typeof parsed.messageId === "string" && parsed.messageId.trim()
      ? parsed.messageId.trim()
      : null;

  const subject =
    typeof parsed.subject === "string" && parsed.subject.trim()
      ? parsed.subject.trim()
      : null;

  const textBody =
    typeof parsed.text === "string" && parsed.text.trim() ? parsed.text : null;

  const htmlBody =
    typeof parsed.html === "string" && parsed.html.trim() ? parsed.html : null;

  return {
    messageIdHeader,
    subject,
    textBody,
    htmlBody,
    headersJson,
    attachments: parseAttachmentsMeta(parsed),
  };
}
