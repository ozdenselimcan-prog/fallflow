"use client";

import { Check, FileText, Mail, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface ServiceMessageView {
  service: string;
  body: string;
  appointmentNote?: string;
}
export interface ServiceTemplateView {
  id: string;
  service: string;
  title: string;
  fileName: string;
  alwaysInclude?: boolean;
}

const DEFAULT_BODY = (service: string) => `Für Ihr Anliegen (${service}) benötigen wir zusätzlich die ausgefüllte Vorlage. Bitte laden Sie sich das Dokument herunter, füllen es aus und schicken es uns wieder zu.`;
const DEFAULT_APPOINTMENT_NOTE = "Vielen Dank, damit habe ich alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen bezüglich eines Termins.";

/** "Sonstiges" ist bereits ein regulärer Wert in SERVICES (lib/cases/fields.ts) – hier nur sichergestellt,
 * dass die Zeile immer auftaucht, auch wenn das Büro sie nicht explizit als Leistung gewählt hat. */
const FALLBACK_SERVICE = "Sonstiges";
/** Interne Kennung für die "bei jeder Anfrage"-Zeile – kein echter Leistungswert, läuft über das separate
 * alwaysInclude-Flag am Dokument statt über die service-Zuordnung. */
const ALWAYS_ROW = "__always__";

function PdfChip({ title, canEdit, onRemove }: { title: string; canEdit: boolean; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-1 pr-1.5 pl-2.5 text-xs font-medium">
      <FileText className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{title}</span>
      {canEdit && (
        <button type="button" onClick={onRemove} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label={`${title} entfernen`}>
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/**
 * Eine Zeile je Leistung (+ "Sonstiges" als Fallback, + "Bei jeder Anfrage" als Sonderzeile): PDF-Vorlagen
 * anhängen und den Nachrichtentext festlegen, den der Assistent dazu verschickt.
 */
export function ServiceMessagesPanel({ services, initialMessages, initialTemplates, canEdit }: { services: string[]; initialMessages: ServiceMessageView[]; initialTemplates: ServiceTemplateView[]; canEdit: boolean }) {
  const rows = [...services, ...(services.includes(FALLBACK_SERVICE) ? [] : [FALLBACK_SERVICE]), ALWAYS_ROW];
  const [bodies, setBodies] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of rows) {
      if (s === ALWAYS_ROW) continue;
      map[s] = initialMessages.find((m) => m.service === s)?.body ?? (s === FALLBACK_SERVICE ? "Vielen Dank für Ihre Anfrage! Bitte laden Sie sich das Dokument herunter, füllen es aus und schicken es uns wieder zu." : DEFAULT_BODY(s));
    }
    return map;
  });
  // Leer = Standard-Formulierung (abhängig vom Ton des Assistenten) wird verwendet, kein eigener Text gespeichert.
  const [appointmentNotes, setAppointmentNotes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of rows) {
      if (s === ALWAYS_ROW) continue;
      map[s] = initialMessages.find((m) => m.service === s)?.appointmentNote ?? "";
    }
    return map;
  });
  const [templates, setTemplates] = useState(initialTemplates);
  const [savedService, setSavedService] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const save = async (service: string) => {
    setError(null);
    setBusyRow(service);
    try {
      await apiFetch("PUT", "/api/service-messages", { service, body: bodies[service] ?? "", appointmentNote: appointmentNotes[service] ?? "" });
      setSavedService(service);
      setTimeout(() => setSavedService((s) => (s === service ? null : s)), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusyRow(null);
    }
  };

  const uploadTemplate = async (row: string, file: File) => {
    setError(null);
    setBusyRow(row);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/document-templates", { method: "POST", body: form });
      const data = (await res.json()) as { template?: ServiceTemplateView; error?: string };
      if (!res.ok || !data.template) throw new Error(data.error ?? "Hochladen fehlgeschlagen");
      const isAlways = row === ALWAYS_ROW;
      // KI-Vorschlag kann abweichen – hier ist die Zeile (Leistung bzw. "immer dabei") bereits bekannt, also fest zuweisen.
      await apiFetch("PUT", `/api/document-templates/${data.template.id}`, isAlways ? { alwaysInclude: true } : { service: row });
      const saved: ServiceTemplateView = isAlways ? { ...data.template, service: "", alwaysInclude: true } : { ...data.template, service: row };
      // Mehrere Vorlagen pro Zeile sind erlaubt (z. B. zwei verschiedene Formulare) – die neue kommt dazu.
      setTemplates((prev) => [...prev, saved]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hochladen fehlgeschlagen");
    } finally {
      setBusyRow(null);
    }
  };

  const removeTemplate = async (id: string) => {
    setError(null);
    await fetch(`/api/document-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-3">
      {error && <Notice tone="error">{error}</Notice>}
      {rows.map((row) => {
        const isAlways = row === ALWAYS_ROW;
        const rowTemplates = isAlways ? templates.filter((t) => t.alwaysInclude) : templates.filter((t) => t.service === row && !t.alwaysInclude);
        return (
          <Card key={row} className={cn(isAlways && "border-accent/40 bg-accent-soft/30")}>
            <CardHeader
              title={isAlways ? "Bei jeder Anfrage dabei" : row}
              description={isAlways ? "Unabhängig von der Leistung – z. B. eine Datenschutz-Einwilligung" : row === FALLBACK_SERVICE ? "Wenn die KI die Leistung nicht eindeutig erkennt" : undefined}
              action={isAlways ? <Mail className="size-4 text-accent" aria-hidden /> : undefined}
            />
            <div className="space-y-3 px-5 pb-5">
              <div className="flex flex-wrap items-center gap-1.5">
                {rowTemplates.map((t) => (
                  <PdfChip key={t.id} title={t.title} canEdit={canEdit} onRemove={() => removeTemplate(t.id)} />
                ))}
                {canEdit && (
                  <>
                    <input
                      ref={(el) => {
                        fileInputs.current[row] = el;
                      }}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadTemplate(row, file);
                      }}
                    />
                    <button
                      type="button"
                      disabled={busyRow === row}
                      onClick={() => fileInputs.current[row]?.click()}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      <Plus className="size-3" /> PDF
                    </button>
                  </>
                )}
              </div>

              {!isAlways && (
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Nachricht</p>
                    <Textarea rows={2} disabled={!canEdit} value={bodies[row] ?? ""} onChange={(e) => setBodies({ ...bodies, [row]: e.target.value })} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Termin-Hinweis, sobald der Fall vollständig ist (leer = Standardtext)</p>
                    <Textarea
                      rows={2}
                      disabled={!canEdit}
                      placeholder={DEFAULT_APPOINTMENT_NOTE}
                      value={appointmentNotes[row] ?? ""}
                      onChange={(e) => setAppointmentNotes({ ...appointmentNotes, [row]: e.target.value })}
                    />
                  </div>
                  {canEdit && (
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="secondary" size="sm" loading={busyRow === row} onClick={() => save(row)}>
                        Speichern
                      </Button>
                      {savedService === row && (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <Check className="size-3.5" /> Gespeichert
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
