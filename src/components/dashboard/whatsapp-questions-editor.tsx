"use client";

import { ArrowDown, ArrowUp, Check, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

interface Q {
  key: string;
  label: string;
  prompt: string;
  services: string[];
}

/**
 * WhatsApp-Fragen: Was der Assistent im WhatsApp-Chat fragt – in dieser Reihenfolge, eine Frage nach der anderen.
 * Ohne eigene Liste macht die KI beim ersten Öffnen einen Vorschlag aus Einrichtung, Profil und Formularen.
 */
export function WhatsAppQuestionsEditor({ canEdit }: { canEdit: boolean }) {
  const [list, setList] = useState<Q[] | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [draft, setDraft] = useState(false);
  const [busy, setBusy] = useState<"load" | "suggest" | "save" | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const suggest = async () => {
    setBusy("suggest");
    setError(null);
    try {
      const r = await apiFetch<{ questions: Q[] }>("POST", "/api/whatsapp-questions");
      setList(r.questions);
      setDraft(true);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vorschlag fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    apiFetch<{ questions: Q[] | null; services: string[] }>("GET", "/api/whatsapp-questions")
      .then(async (r) => {
        setServices(r.services);
        if (r.questions) {
          setList(r.questions);
          setBusy(null);
        } else if (canEdit) await suggest();
        else {
          setList([]);
          setBusy(null);
        }
      })
      .catch(() => {
        setError("Konnte nicht geladen werden");
        setBusy(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (i: number, patch: Partial<Q>) => {
    setList((l) => l!.map((q, k) => (k === i ? { ...q, ...patch } : q)));
    setSaved(false);
    setDraft(true);
  };
  const move = (i: number, d: -1 | 1) => {
    setList((l) => {
      const next = [...l!];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });
    setDraft(true);
    setSaved(false);
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const r = await apiFetch<{ questions: Q[] | null }>("PUT", "/api/whatsapp-questions", { questions: (list ?? []).filter((q) => q.prompt.trim() || q.label.trim()) });
      setList(r.questions ?? []);
      setDraft(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  if (busy === "load" || (busy === "suggest" && !list)) {
    return (
      <Card className="p-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 animate-pulse" /> {busy === "suggest" ? "Die KI erstellt einen Vorschlag aus Ihren Angaben …" : "Wird geladen …"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {draft && <Notice>Vorschlag bzw. Änderungen noch nicht gespeichert – bitte prüfen und speichern.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <ol className="space-y-3">
        {(list ?? []).map((q, i) => (
          <li key={i}>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <span className="mt-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <Textarea rows={2} value={q.prompt} disabled={!canEdit} onChange={(e) => update(i, { prompt: e.target.value })} placeholder="Frage an den Kunden, z. B. Wie groß ist die Fläche ungefähr?" aria-label="Frage" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">In der Fallakte als:</span>
                    <Input className="h-8 max-w-60 text-xs" value={q.label} disabled={!canEdit} onChange={(e) => update(i, { label: e.target.value })} placeholder="Bezeichnung" aria-label="Bezeichnung" />
                  </div>
                  {services.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Fragen bei:</span>
                      {services.map((s) => {
                        const on = !q.services.length || q.services.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={!canEdit}
                            aria-pressed={on}
                            onClick={() => {
                              const current = q.services.length ? q.services : services;
                              const next = on ? current.filter((x) => x !== s) : [...current, s];
                              if (!next.length) return;
                              update(i, { services: next.length === services.length ? [] : next });
                            }}
                            className={cn("rounded-full px-2.5 py-1 text-xs font-medium", on ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground line-through")}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Nach oben">
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === (list?.length ?? 0) - 1} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30" aria-label="Nach unten">
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" onClick={() => { setList((l) => l!.filter((_, k) => k !== i)); setDraft(true); setSaved(false); }} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label="Frage löschen">
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ol>
      {list && list.length === 0 && <p className="text-sm text-muted-foreground">Keine eigenen Fragen – der Assistent fragt im WhatsApp-Chat wie im Website-Chat nach den Angaben aus „Ihr Betrieb“.</p>}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => { setList((l) => [...(l ?? []), { key: "", label: "", prompt: "", services: [] }]); setDraft(true); setSaved(false); }}>
            <Plus className="size-4" /> Frage hinzufügen
          </Button>
          <Button variant="ghost" onClick={suggest} loading={busy === "suggest"}>
            <Sparkles className="size-4" /> Neu vorschlagen lassen
          </Button>
          <div className="flex-1" />
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <Check className="size-4" /> Gespeichert
            </span>
          )}
          <Button onClick={save} loading={busy === "save"}>
            Speichern
          </Button>
        </div>
      )}
    </div>
  );
}
