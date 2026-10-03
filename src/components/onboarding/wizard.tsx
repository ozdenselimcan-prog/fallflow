"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { ConnectionsPanel, type ConnectionView } from "@/components/dashboard/connections-panel";
import { DocumentTemplatesPanel, type DocumentTemplateView } from "@/components/dashboard/document-templates-panel";
import { ServiceMessagesPanel, type ServiceMessageView } from "@/components/dashboard/service-messages-panel";
import { WidgetSnippet } from "@/components/dashboard/widget-snippet";
import { SERVICES, WEEKDAY_LABELS } from "@/lib/cases/fields";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn } from "@/lib/utils";

interface Props {
  firstName: string;
  companyId: string;
  appUrl: string;
  initial: { name: string; website: string; phone: string; address: string; services: string[]; contactFormUrl: string };
  fieldOptions: { key: string; label: string; active: boolean }[];
  widgetReceived: boolean;
  connections: { gmail: ConnectionView | null; microsoft: ConnectionView | null };
  documentTemplates: DocumentTemplateView[];
  serviceMessages: ServiceMessageView[];
}

interface Availability {
  workingDays: number[];
  slotStart: string;
  slotEnd: string;
  slotMinutes: number;
  maxAppointmentsPerDay: number | null;
}

const DEFAULT_AVAILABILITY: Availability = { workingDays: [1, 2, 3, 4, 5], slotStart: "09:00", slotEnd: "17:00", slotMinutes: 60, maxAppointmentsPerDay: null };
/** Anzeigereihenfolge Mo–So; intern 0 (So) – 6 (Sa) wie JS Date.getDay(). */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const STEPS = ["Willkommen", "Unternehmen", "Leistungen", "PDF-Vorlagen", "E-Mail-Texte", "Erfassungsfelder", "Terminvergabe", "Website verbinden", "E-Mail verbinden"];

export function OnboardingWizard({ firstName, companyId, appUrl, initial, fieldOptions, widgetReceived, connections, documentTemplates, serviceMessages }: Props) {
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({ name: initial.name, website: initial.website, phone: initial.phone, address: initial.address, contactFormUrl: initial.contactFormUrl });
  const [services, setServices] = useState<string[]>(initial.services);
  const [active, setActive] = useState<string[]>(fieldOptions.filter((f) => f.active).map((f) => f.key));
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAILABILITY);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useMutation();

  const toggle = (list: string[], value: string, on: boolean) => (on ? [...list, value] : list.filter((x) => x !== value));
  const toggleDay = (day: number) => {
    const has = availability.workingDays.includes(day);
    const next = has ? availability.workingDays.filter((d) => d !== day) : [...availability.workingDays, day];
    setAvailability({ ...availability, workingDays: next.sort((a, b) => a - b) });
  };

  const save = () => run(() => apiFetch("POST", "/api/onboarding", { ...company, services, activeFieldKeys: active, availability }), { refresh: false });

  // Vor dem letzten Schritt (Kanäle verbinden) vorab speichern: Gmail/Microsoft leiten zur
  // Google-/Microsoft-Anmeldung weg, ohne das würden bis dahin eingegebene Angaben verloren gehen.
  const next = async () => {
    if (step === STEPS.length - 2 && !saved) {
      const ok = await save();
      if (!ok) return;
      setSaved(true);
    }
    setStep(step + 1);
  };

  const finish = async () => {
    if (!saved) {
      const ok = await save();
      if (!ok) return;
    }
    // Volles Neuladen statt Client-Navigation: sonst kann eine zwischengespeicherte Weiterleitung zurück ins Onboarding führen.
    window.location.href = "/dashboard";
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <ol className="mb-6 flex gap-1.5" aria-label="Fortschritt">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1.5 rounded-full", i <= step ? "bg-accent" : "bg-border")} />
            <span className={cn("mt-1.5 hidden text-xs sm:block", i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mb-2 text-xs text-muted-foreground sm:hidden">
        Schritt {step + 1} von {STEPS.length}: {STEPS[step]}
      </p>

      <Card className="p-6 sm:p-8">
        {step === 0 && (
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">Willkommen bei FallFlow{firstName ? `, ${firstName}` : ""}</h1>
            <p className="text-muted-foreground">
              In fünf kurzen Schritten richten wir Ihr Büro ein: Firmendaten, Ihre Leistungen, die Angaben für neue Fälle, Ihre Terminvergabe und das Website-Widget. Alles lässt sich später in den Einstellungen ändern.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Unternehmensdaten</h1>
            <Field label="Firmenname">
              <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} required maxLength={120} />
            </Field>
            <Field label="Website">
              <Input type="url" placeholder="https://" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} maxLength={200} />
            </Field>
            <Field label="Telefonnummer">
              <Input type="tel" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} maxLength={40} />
            </Field>
            <Field label="Adresse">
              <Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} maxLength={300} />
            </Field>
            <Field label="Haben Sie ein eigenes Kontaktformular für Kunden? (optional)" hint="Falls ja, Link einfügen – der Assistent schickt ihn Kunden bei jeder neuen Anfrage zuerst mit, zusätzlich zu den eigenen Fragen.">
              <Input type="url" placeholder="https://" value={company.contactFormUrl} onChange={(e) => setCompany({ ...company, contactFormUrl: e.target.value })} maxLength={300} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Welche Leistungen bieten Sie an?</h1>
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICES.map((s) => (
                <Checkbox key={s} label={s} checked={services.includes(s)} onChange={(on) => setServices(toggle(services, s, on))} />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">PDF-Vorlagen (optional)</h1>
            <p className="text-sm text-muted-foreground">
              Schicken Sie Kunden bei bestimmten Leistungen ein auszufüllendes Formular (z. B. eine Vollmacht)? Dann laden Sie es hier hoch – der Assistent verschickt es automatisch, sobald er die passende Leistung erkennt. Nutzen Sie das nicht, überspringen Sie diesen Schritt einfach.
            </p>
            <DocumentTemplatesPanel initial={documentTemplates} canEdit />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Wie sollen die Mails zu Ihren Vorlagen aussehen?</h1>
            <p className="text-sm text-muted-foreground">
              Für jede Leistung können Sie den Text selbst schreiben, den der Assistent zusammen mit der PDF-Vorlage verschickt – inklusive einer eigenen PDF-Vorlage direkt hier, falls Sie vorhin keine hochgeladen haben.
            </p>
            <ServiceMessagesPanel services={services} initialMessages={serviceMessages} initialTemplates={documentTemplates} canEdit />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Welche Informationen benötigen Sie?</h1>
            <p className="text-sm text-muted-foreground">Deaktivierte Angaben fragt der Assistent nicht ab. Pflichtangaben und Reihenfolge passen Sie später im Frage-Flow an.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {fieldOptions.map((f) => (
                <Checkbox key={f.key} label={f.label} checked={active.includes(f.key)} onChange={(on) => setActive(toggle(active, f.key, on))} />
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Wann können Sie Termine anbieten?</h1>
            <p className="text-sm text-muted-foreground">
              Sobald ein Fall vollständig ist, schlägt die KI dem Kunden selbstständig einen freien Termin vor – nur an diesen Tagen, in diesem Zeitfenster.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Verfügbare Wochentage">
              {DISPLAY_ORDER.map((day) => {
                const isActive = availability.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl border text-sm font-medium transition-colors",
                      isActive ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Von">
                <Input type="time" value={availability.slotStart} onChange={(e) => setAvailability({ ...availability, slotStart: e.target.value })} required />
              </Field>
              <Field label="Bis">
                <Input type="time" value={availability.slotEnd} onChange={(e) => setAvailability({ ...availability, slotEnd: e.target.value })} required />
              </Field>
              <Field label="Termindauer (Minuten)">
                <Input type="number" min={15} max={480} step={15} value={availability.slotMinutes} onChange={(e) => setAvailability({ ...availability, slotMinutes: Number(e.target.value) })} required />
              </Field>
              <Field label="Max. Termine pro Tag (optional)" hint="Leer lassen für unbegrenzt (nur durch das Zeitfenster begrenzt).">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  placeholder="unbegrenzt"
                  value={availability.maxAppointmentsPerDay ?? ""}
                  onChange={(e) => setAvailability({ ...availability, maxAppointmentsPerDay: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Website verbinden</h1>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Code kopieren.</li>
              <li>Vor dem schließenden &lt;/body&gt;-Tag Ihrer Website einfügen (bei Website-Baukästen im Bereich „Eigener Code“).</li>
              <li>Website neu laden – der Button „Beratung anfragen“ erscheint unten rechts.</li>
            </ol>
            <WidgetSnippet appUrl={appUrl} companyId={companyId} />
            <div className="flex items-center gap-2 rounded-xl bg-background px-4 py-3 text-sm">
              {widgetReceived ? <CheckCircle2 className="size-4 text-success" /> : <CircleDashed className="size-4 text-muted-foreground" />}
              {widgetReceived ? "Erste Widget-Anfrage empfangen." : "Status: Noch keine Widget-Anfrage empfangen. Sie können diesen Schritt überspringen."}
            </div>
            <a href={`/widget/${companyId}`} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-accent hover:underline">
              Widget in neuem Tab testen →
            </a>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">E-Mail verbinden</h1>
            <p className="text-sm text-muted-foreground">
              Optional, aber empfohlen: Verbinden Sie Ihr Postfach, damit Anfragen von dort automatisch übernommen werden. Sie können das auch später in den Einstellungen nachholen.
            </p>
            <ConnectionsPanel
              appUrl={appUrl}
              companyId={companyId}
              canManage
              gmail={connections.gmail}
              microsoft={connections.microsoft}
              websiteConnected={false}
              showWebsite={false}
            />
          </div>
        )}

        {error && <Notice tone="error" className="mt-4">{error}</Notice>}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || pending}>
            <ArrowLeft className="size-4" /> Zurück
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} loading={pending && step === STEPS.length - 2} disabled={step === 1 && !company.name.trim()}>
              Weiter <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={finish} loading={pending}>
              Abschließen
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
