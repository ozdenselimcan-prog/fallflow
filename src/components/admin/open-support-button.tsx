"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";

/** Betreiber: Konto eines Betriebs im Support-Modus öffnen – nur sichtbar, wenn der Betrieb es erlaubt hat. */
export function OpenSupportButton({ companyId, until }: { companyId: string; until: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const open = async () => {
    setPending(true);
    setError("");
    try {
      await apiFetch("POST", "/api/admin/support-session", { companyId });
      // Volles Neuladen: Die Sitzung wechselt den Betrieb, zwischengespeicherte Seiten dürfen nicht stehen bleiben.
      window.location.href = "/dashboard";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konnte nicht geöffnet werden.");
      setPending(false);
    }
  };
  return (
    <div className="mt-2 space-y-1">
      <Button size="sm" loading={pending} onClick={open}>
        Konto einrichten
      </Button>
      <p className="text-xs text-muted-foreground">Support erlaubt bis {formatDateTime(until)}</p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
