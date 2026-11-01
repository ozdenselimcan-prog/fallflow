"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch, useMutation } from "@/lib/use-api";

/** Löscht alle automatisch erzeugten Testkonten (Mailinator-Testkonten). */
export function CleanupTestAccountsButton({ count }: { count: number }) {
  const { pending, error, run } = useMutation();
  const [result, setResult] = useState<string | null>(null);
  if (count === 0 && !result) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        onClick={async () => {
          if (!window.confirm(`${count} Testkonten (Mailinator-Testkonten) samt allen Daten endgültig löschen?`)) return;
          const res = await run(() => apiFetch<{ deleted: number; failed: number }>("POST", "/api/admin/cleanup-test-accounts"));
          if (res) setResult(`${res.deleted} Testkonten gelöscht${res.failed ? `, ${res.failed} fehlgeschlagen` : ""}.`);
        }}
      >
        <Trash2 className="size-3.5" /> {count} Testkonten löschen
      </Button>
      {result && <span className="text-sm text-muted-foreground">{result}</span>}
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
