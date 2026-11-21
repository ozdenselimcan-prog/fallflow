"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/use-api";

/** Immer sichtbar, solange ein Betreiber das Konto eines Betriebs im Support-Modus bearbeitet (siehe lib/auth/support.ts). */
export function SupportBanner({ companyName }: { companyName: string }) {
  const [pending, setPending] = useState(false);
  const leave = async () => {
    setPending(true);
    await apiFetch("DELETE", "/api/admin/support-session").catch(() => {});
    // Volles Neuladen: Die Sitzung wechselt den Betrieb, zwischengespeicherte Seiten dürfen nicht stehen bleiben.
    window.location.href = "/admin";
  };
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-warning bg-warning-soft px-4 py-3 text-sm">
      <p>
        <span className="font-semibold">Support-Modus:</span> Sie bearbeiten das Konto von <span className="font-semibold">{companyName}</span>. Änderungen gelten sofort für diesen Betrieb.
      </p>
      <Button size="sm" variant="secondary" loading={pending} onClick={leave}>
        Support-Modus verlassen
      </Button>
    </div>
  );
}
