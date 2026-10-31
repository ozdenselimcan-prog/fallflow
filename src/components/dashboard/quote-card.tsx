"use client";

import { FileText, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { euro, quoteTotals, type Quote } from "@/lib/quote";
import { apiFetch } from "@/lib/use-api";

const EMPTY: Quote = { intro: "", items: [], vatRate: 19, validDays: 30, number: "", sentAt: null };

/**
 * Angebot im Fall: KI-Entwurf aus Fallakte und Preisliste, Positionen bearbeiten, PDF ansehen, per E-Mail senden.
 * Preise, die nicht in der Preisliste stehen, bleiben leer – senden geht erst, wenn alle Positionen einen Preis haben.
 */
export function QuoteCard({ caseId, canWrite }: { caseId: string; canWrite: boolean }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [hasEmail, setHasEmail] = useState(false);
  const [busy, setBusy] = useState<"draft" | "save" | "send" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [info, setInfo] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    apiFetch<{ quote: Quote | null; hasEmail: boolean }>("GET", `/api/cases/${caseId}/quote`)
      .then((r) => {
        setQuote(r.quote);
        setHasEmail(r.hasEmail);
      })
      .catch(() => setInfo({ tone: "error", text: "Angebot konnte nicht geladen werden." }));
  }, [caseId]);

  const change = (patch: Partial<Quote>) => {
    setQuote((q) => ({ ...(q ?? EMPTY), ...patch }));
    setDirty(true);
    setInfo(null);
  };
  const setItem = (i: number, patch: Partial<Quote["items"][number]>) => change({ items: (quote?.items ?? []).map((it, k) => (k === i ? { ...it, ...patch } : it)) });

  const draft = async () => {
    setBusy("draft");
    setInfo(null);
    try {
      const r = await apiFetch<{ quote: Quote }>("POST", `/api/cases/${caseId}/quote?action=draft`);
      setQuote(r.quote);
      setDirty(true);
      setInfo({ tone: "info", text: "Entwurf der KI – bitte prüfen. Preise stammen nur aus Ihrer Preisliste; leere Preise bitte ergänzen." });
    } catch (e) {
      setInfo({ tone: "error", text: e instanceof Error ? e.message : "Entwurf fehlgeschlagen" });
    } finally {
      setBusy(null);
    }
  };

  const save = async (): Promise<boolean> => {
    if (!quote) return false;
    setBusy("save");
    try {
      const r = await apiFetch<{ quote: Quote }>("PUT", `/api/cases/${caseId}/quote`, { ...quote, items: quote.items.filter((i) => i.title.trim()) });
      setQuote(r.quote);
      setDirty(false);
      return true;
    } catch (e) {
      setInfo({ tone: "error", text: e instanceof Error ? e.message : "Speichern fehlgeschlagen" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const openPdf = async () => {
    if (dirty && !(await save())) return;
    window.open(`/api/cases/${caseId}/quote/pdf`, "_blank", "noopener");
  };

  const send = async () => {
    if (dirty && !(await save())) return;
    setBusy("send");
    try {
      const r = await apiFetch<{ delivered: boolean; reason: string }>("POST", `/api/cases/${caseId}/quote?action=send`);
      setInfo(r.delivered ? { tone: "success", text: "Angebot per E-Mail an den Kunden gesendet." } : { tone: "error", text: `Nicht versendet: ${r.reason}` });
      if (r.delivered) setQuote((q) => (q ? { ...q, sentAt: new Date().toISOString() } : q));
    } catch (e) {
      setInfo({ tone: "error", text: e instanceof Error ? e.message : "Senden fehlgeschlagen" });
    } finally {
      setBusy(null);
    }
  };

  const q = quote;
  const totals = q ? quoteTotals(q) : null;

  return (
    <Card>
      <CardHeader
        title="Angebot"
        description={q?.sentAt ? `Angebot ${q.number} gesendet am ${new Date(q.sentAt).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}` : "Kostenvoranschlag aus Fallakte und Preisliste – prüfen, ergänzen, als PDF senden."}
        action={
          canWrite && (
            <Button size="sm" variant="secondary" onClick={draft} loading={busy === "draft"}>
              <Sparkles className="size-4" /> {q?.items.length ? "Neu vorschlagen" : "Mit KI vorbereiten"}
            </Button>
          )
        }
      />
      <div className="space-y-4 p-5 text-sm">
        {info && <Notice tone={info.tone}>{info.text}</Notice>}
        {!q?.items.length && !info && <p className="text-muted-foreground">Noch kein Angebot. Die KI schlägt Positionen aus den Angaben des Kunden vor – Preise nur aus Ihrer Preisliste („Wissen &amp; Preise“).</p>}
        {q && q.items.length > 0 && (
          <>
            <Textarea rows={2} value={q.intro} disabled={!canWrite} onChange={(e) => change({ intro: e.target.value })} aria-label="Einleitung" placeholder="Einleitung, z. B. vielen Dank für Ihre Anfrage – gern bieten wir Ihnen an:" />
            <div className="space-y-2">
              {q.items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border p-2 sm:grid-cols-[1fr_4.5rem_6.5rem_7rem_auto] sm:items-center sm:border-0 sm:p-0">
                  <Input value={it.title} disabled={!canWrite} onChange={(e) => setItem(i, { title: e.target.value })} aria-label="Leistung" placeholder="Leistung" className="col-span-2 sm:col-span-1" />
                  <Input type="number" min={0} step="any" value={it.qty} disabled={!canWrite} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} aria-label="Menge" />
                  <Input value={it.unit} disabled={!canWrite} onChange={(e) => setItem(i, { unit: e.target.value })} aria-label="Einheit" />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.unitPrice ?? ""}
                    disabled={!canWrite}
                    onChange={(e) => setItem(i, { unitPrice: e.target.value === "" ? null : Number(e.target.value) })}
                    aria-label="Einzelpreis in Euro"
                    placeholder="Preis €"
                    className={it.unitPrice === null ? "border-warning" : ""}
                  />
                  {canWrite && (
                    <button type="button" onClick={() => change({ items: q.items.filter((_, k) => k !== i) })} className="justify-self-end rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label="Position löschen">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && (
                <Button size="sm" variant="ghost" onClick={() => change({ items: [...q.items, { title: "", qty: 1, unit: "Stk.", unitPrice: null }] })}>
                  <Plus className="size-4" /> Position
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
              <label className="text-xs text-muted-foreground">
                Umsatzsteuer
                <Select value={String(q.vatRate)} disabled={!canWrite} onChange={(e) => change({ vatRate: Number(e.target.value) as 19 | 7 | 0 })} className="mt-1 h-9 w-auto">
                  <option value="19">19 %</option>
                  <option value="7">7 %</option>
                  <option value="0">keine (Kleinunternehmer)</option>
                </Select>
              </label>
              {totals && (
                <div className="text-right tabular-nums">
                  {q.vatRate > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Netto {euro(totals.net)} · MwSt. {euro(totals.vat)}
                    </p>
                  )}
                  <p className="text-base font-semibold">Gesamt {euro(totals.gross)}</p>
                  {!totals.complete && <p className="text-xs text-warning">Bei einigen Positionen fehlt noch der Preis.</p>}
                </div>
              )}
            </div>
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void save()} loading={busy === "save"} disabled={!dirty}>
                  Speichern
                </Button>
                <Button size="sm" variant="secondary" onClick={openPdf}>
                  <FileText className="size-4" /> PDF ansehen
                </Button>
                <Button size="sm" onClick={send} loading={busy === "send"} disabled={!totals?.complete || !hasEmail}>
                  <Send className="size-4" /> An Kunden senden
                </Button>
                {!hasEmail && <span className="self-center text-xs text-muted-foreground">Für das Senden fehlt die E-Mail-Adresse des Kunden.</span>}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
