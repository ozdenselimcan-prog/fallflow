"use client";

import { ArrowLeft, ArrowRight, Mail, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

/**
 * Einrichtung "Ihre Texte": Die KI schreibt aus dem Einrichtungs-Gespräch für jede Leistung den Einstieg der automatischen
 * Antwort (/api/onboarding/texts). Der Betrieb sieht eine komplette Beispiel-Antwort (Testmail, es wird nichts verschickt)
 * und kann jeden Text ändern – gespeichert wird beim Verlassen des Feldes.
 */
export function TextsStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [texts, setTexts] = useState<Record<string, string> | null>(null);
  const [service, setService] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [writing, setWriting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showPreview = useCallback(async (svc: string) => {
    setPreviewing(true);
    setPreview(null);
    try {
      const r = await apiFetch<{ handled: boolean; reply?: string }>("POST", "/api/simulate/email", {
        fromName: "Maria Beispiel",
        subject: `Anfrage ${svc}`,
        body: `Guten Tag, ich interessiere mich für ${svc} und hätte gern ein Angebot. Viele Grüße, Maria Beispiel`,
        preview: true,
      });
      setPreview(r.handled && r.reply ? r.reply : "Für diese Beispiel-Anfrage hätte FallFlow nicht automatisch geantwortet.");
    } catch {
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }, []);

  // Texte schreiben lassen und die erste Leistung gleich als Beispiel zeigen (beim Öffnen und über "Neu schreiben lassen").
  const fetchTexts = useCallback(
    () =>
      apiFetch<{ texts: Record<string, string> }>("POST", "/api/onboarding/texts")
        .then((r) => {
          setTexts(r.texts);
          const first = Object.keys(r.texts)[0] ?? "";
          setService(first);
          if (first) void showPreview(first);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Die Texte konnten nicht erstellt werden.");
          setTexts((t) => t ?? {});
        })
        .finally(() => setWriting(false)),
    [showPreview],
  );

  useEffect(() => {
    void fetchTexts();
  }, [fetchTexts]);

  const write = () => {
    setWriting(true);
    setError(null);
    void fetchTexts();
  };

  const saveText = async (svc: string, body: string) => {
    try {
      await apiFetch("PUT", "/api/service-messages", { service: svc, body });
      if (svc === service) void showPreview(svc);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const services = Object.keys(texts ?? {});
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">So antwortet FallFlow Ihren Kunden</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        Aus Ihren Antworten hat die KI für jede Leistung einen eigenen Einstieg geschrieben. Anrede, die Bitte um fehlende Angaben und Ihre Grußformel ergänzt FallFlow
        automatisch. Ändern Sie, was nicht passt – es wird sofort gespeichert.
      </p>

      {writing && (
        <p className="flex items-center gap-2 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
          <Sparkles className="size-4 animate-pulse" /> Die KI schreibt Ihre Texte …
        </p>
      )}

      {!writing && services.length > 0 && (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">Beispiel-Antwort auf eine Anfrage zu …</p>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={service === s}
                  onClick={() => {
                    setService(s);
                    void showPreview(s);
                  }}
                  className={cn("rounded-full border px-3 py-1.5 text-sm font-medium transition-colors", service === s ? "border-accent bg-accent text-white" : "border-border bg-card hover:border-accent/50")}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Mail className="size-3.5" /> Antwort an Maria Beispiel · nur Vorschau, nichts wird verschickt
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{previewing ? "Vorschau wird erstellt …" : (preview ?? "Keine Vorschau verfügbar.")}</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">Ihre Texte je Leistung</p>
            {services.map((s) => (
              <div key={s} className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{s}</p>
                <Textarea
                  rows={3}
                  value={texts?.[s] ?? ""}
                  maxLength={2000}
                  onChange={(e) => setTexts((t) => ({ ...(t ?? {}), [s]: e.target.value }))}
                  onBlur={(e) => void saveText(s, e.target.value)}
                />
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={write} disabled={writing}>
            <RefreshCw className="size-3.5" /> Neu schreiben lassen
          </Button>
        </div>
      )}

      {error && (
        <Notice tone="error" className="mt-4">
          {error} Sie können auch ohne eigene Texte weitermachen – FallFlow nutzt dann einen kurzen Standardtext.
        </Notice>
      )}

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={writing}>
          <ArrowLeft className="size-4" /> Zurück
        </Button>
        <Button onClick={onDone} disabled={writing}>
          Weiter <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
