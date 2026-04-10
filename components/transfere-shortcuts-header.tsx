"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TransferShortcutsDialog } from "@/components/transfer-shortcuts-dialog";

function TransfereShortcutsHeaderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("raccourcis") === "1") {
      setDialogOpen(true);
      router.replace("/transfere", { scroll: false });
    }
  }, [router, searchParams]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        Gérer les raccourcis
      </Button>
      <TransferShortcutsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onShortcutsChanged={() => router.refresh()}
      />
    </>
  );
}

export function TransfereShortcutsHeader() {
  return (
    <Suspense fallback={null}>
      <TransfereShortcutsHeaderInner />
    </Suspense>
  );
}
