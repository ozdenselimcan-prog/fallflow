"use client";

import { Check, FileText, Lock, Mail, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { DEFAULT_EMAIL_SUBJECT } from "@/lib/cases/fields";
import { profileDocumentsFor, type BusinessProfile } from "@/lib/data/types";
import { defaultDocumentRequirements } from "@/lib/intake/checklist";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

export interface ServiceMessageView {
  service: string;
  body: string;
  appointmentNote?: string;
  requiresFloorplan?: boolean | null;
  requiresEnergyCertificate?: boolean | null;
  subject?: string;
}
export interface ServiceTemplateView {
  id: string;
  service: string;
  title: string;
  fileName: string;
  alwaysInclude?: boolean;
  /** false = nur zur Information mitschicken (Preisliste, Datenschutzhinweis …), kommt nicht ausgefüllt zurück. */
  requiresReturn?: boolean;
}

/** Nur Beispieltext im leeren Feld – leer gespeichert schickt FallFlow einen kurzen Standardtext. */
const BODY_PLACEHOLDER = (service: string) => `Leer = Standardtext („Vielen Dank für Ihre Anfrage zur Leistung „${service}“.“). Beispiel: „Vielen Dank für Ihre Anfrage! Bitte nennen Sie uns noch Ihre Telefonnummer.“`;
const DEFAULT_APPOINTMENT_NOTE = "Vielen Dank, damit habe ich alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen bezüglich eines Termins.";

/** "Sonstiges" bekommt keine eigene Zeile: Erkennt die KI die Leistung nicht, schickt sie nichts automatisch, sondern
 * der Fall landet unter "Aufmerksamkeit benötigt" und das Büro antwortet selbst (siehe engine.ts). */
const FALLBACK_SERVICE = "Sonstiges";
/** Interne Kennung für die "bei jeder Anfrage"-Zeile – kein echter Leistungswert, läuft über das separate
 * alwaysInclude-Flag am Dokument statt über die service-Zuordnung. */
const ALWAYS_ROW = "__always__";

function PdfChip({ title, canEdit, requiresReturn, onToggleReturn, onRemove }: { title: string; canEdit: boolean; requiresReturn: boolean; onToggleReturn: () => void; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-1 pr-1.5 pl-2.5 text-xs font-medium">
      <FileText className="size-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{title}</span>
      <button
        type="button"
        disabled={!canEdit}
        onClick={onToggleReturn}
        title={requiresReturn ? "Kunde soll das Formular ausgefüllt zurückschicken – zum Umschalten klicken" : "Wird nur zur Information mitgeschickt – zum Umschalten klicken"}
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
          requiresReturn ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground",
          canEdit && "hover:ring-1 hover:ring-border",
        )}
      >
        {requiresReturn ? "ausgefüllt zurück" : "nur zur Info"}
      </button>
      {canEdit && (
        <button type="button" onClick={onRemove} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label={`${title} entfernen`}>
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/**
 * Eine Zeile je Leistung (+ "Bei jeder Anfrage" als Sonderzeile): PDF-Vorlagen
 * anhängen und den Nachrichtentext festlegen, den der Assistent dazu verschickt.
 */
export function ServiceMessagesPanel({
  services,
  initialMessages,
  initialTemplates,
  canEdit,
  locked,
  profile,
}: {
  services: string[];
  initialMessages: ServiceMessageView[];
  initialTemplates: ServiceTemplateView[];
  canEdit: boolean;
  /** true = Abo-Plan (Starter) hat keinen Zugriff auf PDF-Vorlagen/Nachrichtentexte. */
  locked?: boolean;
  /** Betrieb mit Betriebsprofil: Unterlagen kommen aus dem Profil statt Grundriss/Energieausweis. */
  profile?: Pick<BusinessProfile, "documents" | "documentsByService"> | null;
}) {
  const rows = [...services.filter((s) => s !== FALLBACK_SERVICE), ALWAYS_ROW];
  const [profileDocs, setProfileDocs] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(rows.filter((s) => s !== ALWAYS_ROW).map((s) => [s, profile ? profileDocumentsFor(profile, s) : []])),
  );
  const [bodies, setBodies] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of rows) {
      if (s === ALWAYS_ROW) continue;
      map[s] = initialMessages.find((m) => m.service === s)?.body ?? "";
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
  // Welche Dokumente braucht das Büro für diese Leistung wirklich? Ohne eigene Angabe gilt die Standard-Logik
  // je Leistung (z. B. Grundriss normalerweise Pflicht, Energieausweis nur bei bestimmten Leistungen).
  const [docReqs, setDocReqs] = useState<Record<string, { floorplan: boolean; energyCertificate: boolean }>>(() => {
    const map: Record<string, { floorplan: boolean; energyCertificate: boolean }> = {};
    for (const s of rows) {
      if (s === ALWAYS_ROW) continue;
      const stored = initialMessages.find((m) => m.service === s);
      const defaults = defaultDocumentRequirements(s);
      map[s] = { floorplan: stored?.requiresFloorplan ?? defaults.floorplan, energyCertificate: stored?.requiresEnergyCertificate ?? defaults.energyCertificate };
    }
    return map;
  });
  // Leer = Standardbetreff.
  const [subjects, setSubjects] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of rows) {
      if (s === ALWAYS_ROW) continue;
      map[s] = initialMessages.find((m) => m.service === s)?.subject ?? "";
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
      await apiFetch("PUT", "/api/service-messages", {
        service,
        body: bodies[service] ?? "",
        appointmentNote: appointmentNotes[service] ?? "",
        // Betriebe mit Betriebsprofil verlangen nie Grundriss/Energieausweis (Energieberatungs-Standard).
        requiresFloorplan: profile ? false : (docReqs[service]?.floorplan ?? true),
        requiresEnergyCertificate: profile ? false : (docReqs[service]?.energyCertificate ?? false),
        subject: subjects[service] ?? "",
        ...(profile ? { profileDocuments: profileDocs[service] ?? [] } : {}),
      });
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

  const toggleReturn = async (t: ServiceTemplateView) => {
    setError(null);
    const requiresReturn = t.requiresReturn === false;
    try {
      await apiFetch("PUT", `/api/document-templates/${t.id}`, { requiresReturn });
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, requiresReturn } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  };

  const removeTemplate = async (id: string) => {
    setError(null);
    await fetch(`/api/document-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  if (locked) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="font-semibold">PDF-Vorlagen & Nachrichtentexte</h2>
            <p className="text-sm text-muted-foreground">Ab dem Pro-Plan verfügbar.</p>
          </div>
        </div>
        <Link href="/dashboard/settings/billing" className={buttonStyles({ variant: "secondary" })}>
          Plan upgraden
        </Link>
      </Card>
    );
  }

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
              description={isAlways ? "Unabhängig von der Leistung – z. B. eine Datenschutz-Einwilligung" : undefined}
              action={isAlways ? <Mail className="size-4 text-accent" aria-hidden /> : undefined}
            />
            <div className="space-y-3 px-5 pb-5">
              <div className="flex flex-wrap items-center gap-1.5">
                {rowTemplates.map((t) => (
                  <PdfChip
                    key={t.id}
                    title={t.title}
                    canEdit={canEdit}
                    requiresReturn={t.requiresReturn !== false}
                    onToggleReturn={() => void toggleReturn(t)}
                    onRemove={() => removeTemplate(t.id)}
                  />
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
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Betreff der E-Mail (leer = Standardbetreff)</p>
                    <Input disabled={!canEdit} maxLength={200} placeholder={DEFAULT_EMAIL_SUBJECT} value={subjects[row] ?? ""} onChange={(e) => setSubjects({ ...subjects, [row]: e.target.value })} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Nachricht – Tipp: Schreiben Sie hier, was Sie vom Kunden brauchen (z. B. „Bitte senden Sie uns Ihre Telefonnummer und E-Mail-Adresse“). Das zählt per E-Mail automatisch als benötigte Angabe. Den Hinweis auf angehängte Formulare und benötigte Unterlagen ergänzt FallFlow automatisch.
                    </p>
                    <Textarea rows={3} disabled={!canEdit} placeholder={BODY_PLACEHOLDER(row)} value={bodies[row] ?? ""} onChange={(e) => setBodies({ ...bodies, [row]: e.target.value })} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Abschluss-Nachricht an den Kunden, sobald alle Angaben für diese Leistung vollständig sind (leer = Standardtext)
                    </p>
                    <Textarea
                      rows={2}
                      disabled={!canEdit}
                      placeholder={DEFAULT_APPOINTMENT_NOTE}
                      value={appointmentNotes[row] ?? ""}
                      onChange={(e) => setAppointmentNotes({ ...appointmentNotes, [row]: e.target.value })}
                    />
                  </div>
                  {profile ? (
                    profile.documents.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Welche Unterlagen soll der Kunde bei dieser Leistung schicken?</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {profile.documents.map((d) => (
                            <Checkbox
                              key={d}
                              label={d}
                              disabled={!canEdit}
                              checked={(profileDocs[row] ?? []).includes(d)}
                              onChange={(v) => {
                                const current = profileDocs[row] ?? [];
                                setProfileDocs({ ...profileDocs, [row]: v ? [...current, d] : current.filter((x) => x !== d) });
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  ) : (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Welche Angaben benötigen Sie bei dieser Leistung?</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Checkbox
                        label="Grundriss"
                        disabled={!canEdit}
                        checked={docReqs[row]?.floorplan ?? true}
                        onChange={(v) => setDocReqs({ ...docReqs, [row]: { ...docReqs[row], floorplan: v, energyCertificate: docReqs[row]?.energyCertificate ?? false } })}
                      />
                      <Checkbox
                        label="Energieausweis"
                        disabled={!canEdit}
                        checked={docReqs[row]?.energyCertificate ?? false}
                        onChange={(v) => setDocReqs({ ...docReqs, [row]: { ...docReqs[row], floorplan: docReqs[row]?.floorplan ?? true, energyCertificate: v } })}
                      />
                    </div>
                  </div>
                  )}
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
