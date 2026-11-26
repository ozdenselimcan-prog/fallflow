"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OpenSupportButton } from "@/components/admin/open-support-button";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import type { ManagedSetup } from "@/lib/data/types";
import { apiFetch } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";

interface Row {
  companyId: string;
  company: string;
  setup: ManagedSetup;
  supportUntil: string | null;
}

const STATUS: Record<ManagedSetup["status"], { label: string; tone: "accent" | "warning" | "success" | "danger" }> = {
  generating: { label: "Wird eingerichtet …", tone: "accent" },
  ready: { label: "Wartet auf Prüfung", tone: "warning" },
  released: { label: "Zugang verschickt", tone: "success" },
  failed: { label: "Einrichtung fehlgeschlagen", tone: "danger" },
};

/** Betreiber: über den Fragebogen auf /einrichtung angelegte Konten prüfen und freischalten. */
export function ManagedSetups({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});
  if (!rows.length) return null;

  const act = async (companyId: string, action: "release" | "retry") => {
    if (action === "release" && !window.confirm("Zugang jetzt per E-Mail an den Betrieb schicken? Damit startet die Testphase.")) return;
    setBusy(companyId + action);
    try {
      await apiFetch("POST", "/api/admin/managed-setup", { companyId, action });
      setMessage({ ...message, [companyId]: action === "release" ? "Zugang verschickt." : "Einrichtung läuft erneut – in etwa einer Minute neu laden." });
      router.refresh();
    } catch (e) {
      setMessage({ ...message, [companyId]: e instanceof Error ? e.message : "Fehlgeschlagen" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mt-6 p-4">
      <h2 className="font-semibold">Einrichtungen über die Website</h2>
      <p className="mt-1 text-xs text-muted-foreground">Konto öffnen, prüfen (Leistungen, Texte, Preise) und dann freischalten – erst dann bekommt der Betrieb eine Mail und die Testphase startet.</p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((r) => {
          const s = STATUS[r.setup.status];
          return (
            <li key={r.companyId} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{r.company}</p>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </div>
                <p className="mt-1 text-sm">
                  {r.setup.contactName} · <a href={`tel:${r.setup.phone}`} className="underline">{r.setup.phone}</a> · {r.setup.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Angefragt {formatDateTime(r.setup.requestedAt)}
                  {r.setup.releasedAt ? ` · freigeschaltet ${formatDateTime(r.setup.releasedAt)}` : ""}
                  {r.setup.trialUsedBefore ? " · Testphase schon genutzt (keine neue)" : ""}
                </p>
                {r.setup.note && <p className="mt-1 text-sm text-muted-foreground">„{r.setup.note}“</p>}
                {r.setup.error && <p className="mt-1 text-xs text-danger">{r.setup.error}</p>}
                {message[r.companyId] && <p className="mt-1 text-xs">{message[r.companyId]}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                {r.supportUntil && r.setup.status !== "generating" && <OpenSupportButton companyId={r.companyId} until={r.supportUntil} />}
                {r.setup.status === "ready" && (
                  <Button size="sm" loading={busy === r.companyId + "release"} onClick={() => act(r.companyId, "release")}>
                    Freischalten & Zugang senden
                  </Button>
                )}
                {r.setup.status === "failed" && (
                  <Button size="sm" variant="secondary" loading={busy === r.companyId + "retry"} onClick={() => act(r.companyId, "retry")}>
                    Erneut einrichten
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
