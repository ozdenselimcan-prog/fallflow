"use client";

import { Check, PiggyBank, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

interface Props {
  caseId: string;
  hasEmail: boolean;
  canWrite: boolean;
}

/**
 * Grobe, unverbindliche Förderschätzung (BAFA/KfW) – wird NIE automatisch verschickt. Das Büro erstellt
 * den Entwurf, prüft/bearbeitet den Text und schickt ihn erst nach bewusstem Klick an den Kunden.
 */
export function FoerderEstimateCard({ caseId, hasEmail, canWrite }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setSent(false);
    setGenerating(true);
    try {
      const res = await apiFetch<{ draft: string }>("POST", `/api/cases/${caseId}/foerder-estimate`, {});
      setDraft(res.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schätzung konnte nicht erstellt werden");
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!draft) return;
    setError(null);
    setSending(true);
    try {
      await apiFetch("POST", "/api/messages", { caseId, content: draft, kind: "email" });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Senden fehlgeschlagen");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Förderschätzung"
        description="Grobe Orientierung zu BAFA/KfW – immer erst prüfen, dann selbst verschicken"
        action={
          canWrite && (
            <Button variant="secondary" size="sm" loading={generating} onClick={generate}>
              <PiggyBank className="size-3.5" /> {draft ? "Neu erstellen" : "Schätzung erstellen"}
            </Button>
          )
        }
      />
      <div className="px-5 py-4">
        {error && (
          <div className="mb-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        {draft ? (
          <div className="space-y-3">
            <Textarea rows={8} disabled={!canWrite} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <p className="text-xs text-muted-foreground">Unverbindliche Erst-Einschätzung – bitte vor dem Versand kurz gegenprüfen, ob Angaben und Bonus-Bedingungen für diesen Fall wirklich passen.</p>
            {canWrite && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" loading={sending} disabled={!hasEmail} onClick={send}>
                  <Send className="size-3.5" /> An Kunden senden
                </Button>
                {!hasEmail && <span className="text-xs text-muted-foreground">Keine E-Mail-Adresse im Fall hinterlegt.</span>}
                {sent && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check className="size-3.5" /> Gesendet
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <PiggyBank className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>Noch keine Schätzung erstellt. Berechnet eine grobe Förderspanne (Grundförderung, Geschwindigkeits- und Einkommensbonus) aus den Fall-Angaben – nur für förderrelevante Leistungen verfügbar.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
