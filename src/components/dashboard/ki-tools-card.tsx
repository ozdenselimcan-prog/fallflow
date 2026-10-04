"use client";

import { Check, Microscope, PiggyBank, Ruler, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import type { CaseEvent } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn, formatDateTime } from "@/lib/utils";

interface Props {
  caseId: string;
  events: CaseEvent[];
  yearBuilt: string | undefined;
  hasEmail: boolean;
  canWrite: boolean;
}

type Tab = "assessment" | "foerder" | "uvalues";
const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: "assessment", label: "Voreinschätzung", icon: Sparkles },
  { id: "foerder", label: "Förderschätzung", icon: PiggyBank },
  { id: "uvalues", label: "Bauteilwerte", icon: Ruler },
];

function AssessmentTab({ caseId, events, canWrite }: { caseId: string; events: CaseEvent[]; canWrite: boolean }) {
  const { pending, error, run } = useMutation();
  const latest = [...events].reverse().find((e) => e.type === "assessment");
  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">Vorbereitungshilfe für den Berater – unverbindlich, ersetzt keine fachliche Prüfung.</p>
        {canWrite && (
          <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => apiFetch("POST", `/api/cases/${caseId}/preliminary-assessment`, {}))}>
            <Sparkles className="size-3.5" /> {latest ? "Neu erstellen" : "Erstellen"}
          </Button>
        )}
      </div>
      {error && (
        <div className="mb-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {latest ? (
        <div>
          <p className="whitespace-pre-line text-sm leading-relaxed">{latest.text}</p>
          <p className="mt-3 text-xs text-muted-foreground">Erstellt am {formatDateTime(latest.createdAt)} · nur intern, nicht für den Kunden.</p>
        </div>
      ) : (
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Microscope className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>Noch keine Voreinschätzung erstellt. Nutzt Gebäudedaten und hochgeladene Dokumente, um typische Schwachstellen und Prüfpunkte für das Gespräch zusammenzufassen.</p>
        </div>
      )}
    </div>
  );
}

function FoerderTab({ caseId, hasEmail, canWrite }: { caseId: string; hasEmail: boolean; canWrite: boolean }) {
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
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">Grobe Orientierung zu BAFA/KfW – immer erst prüfen, dann selbst verschicken.</p>
        {canWrite && (
          <Button variant="secondary" size="sm" loading={generating} onClick={generate}>
            <PiggyBank className="size-3.5" /> {draft ? "Neu erstellen" : "Schätzung erstellen"}
          </Button>
        )}
      </div>
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
          <p>Noch keine Schätzung erstellt. Berechnet eine grobe Förderspanne (Grundförderung, Geschwindigkeits- und Einkommensbonus) – nur für förderrelevante Leistungen verfügbar.</p>
        </div>
      )}
    </div>
  );
}

const BAUTEIL_LABELS: { key: "wall" | "window" | "roof"; label: string; fieldKey: string }[] = [
  { key: "wall", label: "Außenwand", fieldKey: "uValueWall" },
  { key: "window", label: "Fenster", fieldKey: "uValueWindow" },
  { key: "roof", label: "Dach", fieldKey: "uValueRoof" },
];

function UValuesTab({ caseId, yearBuilt, canWrite }: { caseId: string; yearBuilt: string | undefined; canWrite: boolean }) {
  const { pending, run } = useMutation();
  const [suggestion, setSuggestion] = useState<{ classLabel: string; wall: number; window: number; roof: number } | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setAccepted(new Set());
    setDismissed(new Set());
    try {
      const res = await apiFetch<{ suggestion: { classLabel: string; wall: number; window: number; roof: number } }>("POST", `/api/cases/${caseId}/u-values`, {});
      setSuggestion(res.suggestion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Richtwerte konnten nicht berechnet werden");
    }
  };

  const accept = async (fieldKey: string, value: number) => {
    setBusyKey(fieldKey);
    try {
      await apiFetch("PATCH", `/api/cases/${caseId}`, { fields: { [fieldKey]: String(value) } });
      setAccepted((prev) => new Set(prev).add(fieldKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Übernehmen fehlgeschlagen");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">Richtwerte je Baualtersklasse – keine Messwerte, bitte vor Ort prüfen.</p>
        {canWrite && (
          <Button variant="secondary" size="sm" loading={pending} onClick={() => run(generate, { refresh: false })}>
            <Ruler className="size-3.5" /> {suggestion ? "Neu berechnen" : "Richtwerte vorschlagen"}
          </Button>
        )}
      </div>
      {error && (
        <div className="mb-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {suggestion ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Baualtersklasse: {suggestion.classLabel}</p>
          {BAUTEIL_LABELS.filter(({ fieldKey }) => !dismissed.has(fieldKey)).map(({ key, label, fieldKey }) => {
            const isAccepted = accepted.has(fieldKey);
            return (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2">
                <span className="text-sm">
                  {label}: <span className="font-semibold tabular-nums">{suggestion[key]}</span> W/(m²K)
                </span>
                {canWrite &&
                  (isAccepted ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <Check className="size-3.5" /> Übernommen
                    </span>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="secondary" size="sm" loading={busyKey === fieldKey} onClick={() => accept(fieldKey, suggestion[key])}>
                        Übernehmen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDismissed((prev) => new Set(prev).add(fieldKey))}
                        className="text-muted-foreground"
                        title="Ignorieren"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Ruler className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{yearBuilt ? "Noch keine Richtwerte berechnet." : "Benötigt ein Baujahr im Fall, um Richtwerte vorzuschlagen."}</p>
        </div>
      )}
    </div>
  );
}

/** Bündelt die drei KI-Werkzeuge einer Fallakte (Voreinschätzung, Förderschätzung, Bauteilwerte) in
 * einer Karte mit Reitern statt drei separaten, langen Karten untereinander. */
export function KiToolsCard({ caseId, events, yearBuilt, hasEmail, canWrite }: Props) {
  const [tab, setTab] = useState<Tab>("assessment");

  return (
    <Card className="p-0">
      <nav aria-label="KI-Werkzeuge" className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </nav>
      <div className="p-5">
        {tab === "assessment" && <AssessmentTab caseId={caseId} events={events} canWrite={canWrite} />}
        {tab === "foerder" && <FoerderTab caseId={caseId} hasEmail={hasEmail} canWrite={canWrite} />}
        {tab === "uvalues" && <UValuesTab caseId={caseId} yearBuilt={yearBuilt} canWrite={canWrite} />}
      </div>
    </Card>
  );
}
