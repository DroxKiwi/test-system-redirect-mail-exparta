"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type BoiteMarkReadOnOpenProps = {
  messageId: number;
  gmailMessageId: string | null;
  /** Déjà lu en base : ne rien faire */
  alreadyRead: boolean;
  /** Réglage application : marquer lu à l'ouverture */
  enabled: boolean;
};

/**
 * À l'ouverture d'un message Gmail, appelle l'API pour retirer le libellé NON LU côté Google
 * et renseigner readAt en base (une seule fois).
 */
export function BoiteMarkReadOnOpen({
  messageId,
  gmailMessageId,
  alreadyRead,
  enabled,
}: BoiteMarkReadOnOpenProps) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || alreadyRead || !gmailMessageId?.trim() || ran.current) {
      return;
    }
    ran.current = true;

    void (async () => {
      const res = await fetch("/api/gmail/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = (await res.json()) as { ok?: boolean; skipped?: boolean };
      if (res.ok && data.ok) {
        router.refresh();
      }
    })();
  }, [messageId, gmailMessageId, alreadyRead, enabled, router]);

  return null;
}
