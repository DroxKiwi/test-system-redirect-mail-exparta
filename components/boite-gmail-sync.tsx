"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type BoiteGmailSyncProps = {
  pollIntervalSeconds: number;
  gmailConnected: boolean;
  /** false = import de toute la boîte (réglages Gmail) */
  gmailSyncUnreadOnly: boolean;
};

export function BoiteGmailSync({
  pollIntervalSeconds,
  gmailConnected,
  gmailSyncUnreadOnly,
}: BoiteGmailSyncProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef(false);

  const runSync = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSyncing(true);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [router]);

  const initialSyncDone = useRef(false);

  useEffect(() => {
    if (!gmailConnected || pollIntervalSeconds <= 0) {
      return;
    }
    if (initialSyncDone.current) {
      return;
    }
    initialSyncDone.current = true;
    void runSync();
  }, [gmailConnected, pollIntervalSeconds, runSync]);

  useEffect(() => {
    if (!gmailConnected || pollIntervalSeconds <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      void runSync();
    }, pollIntervalSeconds * 1000);
    return () => window.clearInterval(id);
  }, [gmailConnected, pollIntervalSeconds, runSync]);

  if (!gmailConnected) {
    return (
      <p className="text-xs text-muted-foreground">
        Connecte Gmail dans Reglages pour synchroniser ta boîte Google ici.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {pollIntervalSeconds > 0 ? (
        <span>
          Synchro Gmail : toutes les {pollIntervalSeconds} s (
          {gmailSyncUnreadOnly ? (
            <>
              <strong>non lus</strong> uniquement
            </>
          ) : (
            <>
              <strong>toute la boîte</strong> (nouveaux en premier)
            </>
          )}
          , max. 40 par passage). {syncing ? "Synchronisation en cours…" : null}
        </span>
      ) : (
        <>
          <span>Pas de synchro automatique (regle l&apos;intervalle dans Reglages).</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={() => void runSync()}
          >
            {syncing ? "Synchronisation…" : "Synchroniser Gmail"}
          </Button>
        </>
      )}
    </div>
  );
}
