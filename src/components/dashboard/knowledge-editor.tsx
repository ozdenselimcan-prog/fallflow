"use client";

import { Check, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

interface Price {
  item: string;
  price: string;
  note: string;
}
interface Faq {
  q: string;
  a: string;
}

/**
 * „Wissen & Preise“: feste Preise und häufige Fragen. Daraus beantwortet die KI Kundenfragen per E-Mail, WhatsApp und im
 * Website-Chat – Preise nur wörtlich aus dieser Liste. Beim ersten Öffnen: je Leistung eine leere Preiszeile und typische
 * Fragen der Branche als Vorschlag (Antworten trägt der Betrieb selbst ein).
 */
export function KnowledgeEditor({ canEdit }: { canEdit: boolean }) {
  const [prices, setPrices] = useState<Price[] | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [busy, setBusy] = useState<"suggest" | "save" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstVisit, setFirstVisit] = useState(false);

  const suggestQuestions = async () => {
    setBusy("suggest");
    setError(null);
    try {
      const r = await apiFetch<{ questions: string[] }>("POST", "/api/knowledge");
      setFaqs((current) => {
        const have = new Set(current.map((f) => f.q.trim().toLowerCase()));
        return [...current, ...r.questions.filter((q) => !have.has(q.toLowerCase())).map((q) => ({ q, a: "" }))];
      });
      setDirty(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vorschläge fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    apiFetch<{ knowledge: { prices: { item: string; price: string; note?: string }[]; faqs: Faq[] } | null; services: string[] }>("GET", "/api/knowledge")
      .then(async (r) => {
        if (r.knowledge) {
          setPrices(r.knowledge.prices.map((p) => ({ ...p, note: p.note ?? "" })));
          setFaqs(r.knowledge.faqs);
          return;
        }
        // Erster Besuch: je Leistung eine Zeile zum Ausfüllen, dazu typische Fragen der Branche.
        setFirstVisit(true);
        setPrices(r.services.map((s) => ({ item: s, price: "", note: "" })));
        if (canEdit) await suggestQuestions();
      })
      .catch(() => setError("Konnte nicht geladen werden"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = () => {
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const r = await apiFetch<{ knowledge: { prices: { item: string; price: string; note?: string }[]; faqs: Faq[] } }>("PUT", "/api/knowledge", { prices: prices ?? [], faqs });
      // Unvollständige Zeilen bleiben zum Weiterausfüllen stehen; gespeichert sind nur die vollständigen.
      setSaved(true);
      setDirty(false);
      setFirstVisit(false);
      if (!r.knowledge.prices.length && !r.knowledge.faqs.length) setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  if (!prices) return error ? <Notice tone="error">{error}</Notice> : <p className="text-sm text-muted-foreground">Wird geladen …</p>;

  const filledPrices = prices.filter((p) => p.item.trim() && p.price.trim()).length;
  const filledFaqs = faqs.filter((f) => f.q.trim() && f.a.trim()).length;

  return (
    <div className="space-y-6">
      <Notice tone="info">
        Was hier steht, darf die KI Ihren Kunden sagen – per E-Mail, WhatsApp und im Website-Chat. Preise nennt sie nur wörtlich aus dieser Liste; alles andere (z. B. „Was kostet
        ein neues Dach?“) geht wie bisher an Sie. Zeilen ohne Preis bzw. ohne Antwort werden nicht verwendet.
      </Notice>
      {firstVisit && <Notice>Wir haben Ihre Leistungen und typische Fragen Ihrer Branche schon eingetragen – ergänzen Sie Preise und Antworten, wo es passt, und speichern Sie.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <Card>
        <CardHeader title="Preisliste" description={`Feste Preise, die die KI nennen darf (${filledPrices} ausgefüllt). Z. B. „Herrenschnitt – 25 €“ oder „Energieausweis – ab 299 €“.`} />
        <div className="space-y-2 p-5">
          {prices.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1.4fr_0.8fr_1.6fr_auto] sm:items-center sm:border-0 sm:p-0">
              <Input value={p.item} disabled={!canEdit} placeholder="Leistung, z. B. Herrenschnitt" aria-label="Leistung" onChange={(e) => { setPrices(prices.map((x, k) => (k === i ? { ...x, item: e.target.value } : x))); touch(); }} />
              <Input value={p.price} disabled={!canEdit} placeholder="Preis, z. B. 25 € oder ab 299 €" aria-label="Preis" onChange={(e) => { setPrices(prices.map((x, k) => (k === i ? { ...x, price: e.target.value } : x))); touch(); }} />
              <Input value={p.note} disabled={!canEdit} placeholder="Hinweis (optional), z. B. inkl. Waschen" aria-label="Hinweis" onChange={(e) => { setPrices(prices.map((x, k) => (k === i ? { ...x, note: e.target.value } : x))); touch(); }} />
              {canEdit && (
                <button type="button" onClick={() => { setPrices(prices.filter((_, k) => k !== i)); touch(); }} className="justify-self-end rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label="Zeile löschen">
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => { setPrices([...prices, { item: "", price: "", note: "" }]); touch(); }}>
              <Plus className="size-4" /> Preis hinzufügen
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Häufige Fragen" description={`Fragen, die Kunden immer wieder stellen, mit Ihrer Antwort (${filledFaqs} beantwortet). Z. B. Öffnungszeiten, Zahlungsarten, Einzugsgebiet.`} />
        <div className="space-y-3 p-5">
          {faqs.map((f, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-start gap-2">
                <Input value={f.q} disabled={!canEdit} placeholder="Frage, z. B. Haben Sie samstags geöffnet?" aria-label="Frage" onChange={(e) => { setFaqs(faqs.map((x, k) => (k === i ? { ...x, q: e.target.value } : x))); touch(); }} />
                {canEdit && (
                  <button type="button" onClick={() => { setFaqs(faqs.filter((_, k) => k !== i)); touch(); }} className="mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label="Frage löschen">
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <Textarea rows={2} value={f.a} disabled={!canEdit} placeholder="Ihre Antwort – leer lassen, wenn die Frage nicht verwendet werden soll" aria-label="Antwort" onChange={(e) => { setFaqs(faqs.map((x, k) => (k === i ? { ...x, a: e.target.value } : x))); touch(); }} />
            </div>
          ))}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setFaqs([...faqs, { q: "", a: "" }]); touch(); }}>
                <Plus className="size-4" /> Frage hinzufügen
              </Button>
              <Button variant="ghost" size="sm" onClick={suggestQuestions} loading={busy === "suggest"}>
                <Sparkles className="size-4" /> Weitere Fragen vorschlagen
              </Button>
            </div>
          )}
        </div>
      </Card>

      {canEdit && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:bottom-4">
          <p className="text-sm text-muted-foreground">{dirty ? "Noch nicht gespeichert" : `${filledPrices} Preise · ${filledFaqs} Antworten`}</p>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-success">
                <Check className="size-4" /> Gespeichert
              </span>
            )}
            <Button onClick={save} loading={busy === "save"}>
              Speichern
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
