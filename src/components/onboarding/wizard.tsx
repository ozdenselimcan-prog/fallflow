"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { AppointmentConfirmationCard } from "@/components/dashboard/appointment-confirmation-card";
import { BusinessProfileEditor, EMPTY_DRAFT, type ProfileDraft } from "@/components/onboarding/business-profile-editor";
import { SetupVideoButton } from "@/components/ui/setup-video";
import { ConnectionsPanel, type ConnectionView } from "@/components/dashboard/connections-panel";
import { ServiceMessagesPanel, type ServiceMessageView, type ServiceTemplateView } from "@/components/dashboard/service-messages-panel";
import { WhatsAppCard } from "@/components/dashboard/whatsapp-card";
import { WidgetSnippet } from "@/components/dashboard/widget-snippet";
import { WEEKDAY_LABELS } from "@/lib/cases/fields";
import type { AssistantSettings } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn } from "@/lib/utils";

interface Props {
  firstName: string;
  companyId: string;
  appUrl: string;
  initial: { name: string; website: string; phone: string; address: string; services: string[] };
  widgetReceived: boolean;
  connections: { gmail: ConnectionView | null; microsoftAvailable: boolean };
  /** Ergebnis der Microsoft-Anmeldung (?integration=…) – dann direkt beim Schritt "E-Mail verbinden" weitermachen. */
  integrationResult?: string;
  documentTemplates: ServiceTemplateView[];
  serviceMessages: ServiceMessageView[];
  /** Bereits gespeichertes Betriebsprofil (z. B. nach Microsoft-Anmeldung zurück in der Einrichtung) */
  initialProfile?: ProfileDraft;
  assistant: AssistantSettings;
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

const STEPS = ["Willkommen", "Unternehmen", "Ihr Betrieb", "Vorlagen & Nachrichten", "Terminvergabe", "Website verbinden", "WhatsApp", "E-Mail verbinden"];

export function OnboardingWizard({ firstName, companyId, appUrl, initial, widgetReceived, connections, documentTemplates, serviceMessages, assistant, integrationResult, initialProfile }: Props) {
  // Zurück von der Microsoft-Anmeldung: Angaben davor sind schon gespeichert, weiter beim letzten Schritt.
  const [step, setStep] = useState(integrationResult ? STEPS.length - 1 : 0);
  const [company, setCompany] = useState({ name: initial.name, website: initial.website, phone: initial.phone, address: initial.address });
  const [services, setServices] = useState<string[]>(initial.services);
  const [profile, setProfile] = useState<ProfileDraft>(initialProfile ?? EMPTY_DRAFT);
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAILABILITY);
  const [saved, setSaved] = useState(Boolean(integrationResult));
  const { pending, error, run } = useMutation();

  const toggleDay = (day: number) => {
    const has = availability.workingDays.includes(day);
    const next = has ? availability.workingDays.filter((d) => d !== day) : [...availability.workingDays, day];
    setAvailability({ ...availability, workingDays: next.sort((a, b) => a - b) });
  };

  const save = () => run(() => apiFetch("POST", "/api/onboarding", { ...company, services, availability }), { refresh: false });

  // Vor dem letzten Schritt (Kanäle verbinden) vorab speichern, damit bis dahin eingegebene Angaben
  // nicht verloren gehen, falls der nächste Schritt die Seite verlässt (z. B. Gmail-Test).
  const next = async () => {
    // "Ihr Betrieb": Profil speichern – danach arbeitet der Assistent mit genau diesen Leistungen und Angaben.
    if (step === 2) {
      const ok = await run(() => apiFetch("PUT", "/api/business-profile", profile), { refresh: false });
      if (!ok) return;
      setServices(profile.services);
    }
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
              In wenigen Schritten richten wir FallFlow für Ihren Betrieb ein: Firmendaten, Ihre Leistungen und was der Assistent erfragen soll, Ihre Vorlagen &amp; Nachrichten, die Terminvergabe, den Website-Chat, WhatsApp und Ihr E-Mail-Postfach. Alles lässt sich später in den Einstellungen ändern.
            </p>
            <SetupVideoButton label="Erst kurz ansehen, wie es geht" className="mt-4" />
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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Ihr Betrieb</h1>
            <p className="text-sm text-muted-foreground">
              Damit der Assistent Ihre Anfragen richtig versteht, beschreiben Sie kurz Ihren Betrieb. Die KI schlägt daraus Ihre Leistungen, die nötigen
              Angaben und Unterlagen vor – Sie prüfen und ändern alles nach Belieben.
            </p>
            <BusinessProfileEditor value={profile} onChange={setProfile} website={company.website} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">PDF-Vorlagen & Nachrichtentexte (optional)</h1>
            <p className="text-sm text-muted-foreground">
              Schicken Sie Kunden bei bestimmten Leistungen ein auszufüllendes Formular (z. B. eine Vollmacht)? Hier pro Leistung hochladen und den Nachrichtentext dazu festlegen. Mit einem Klick auf die PDF legen Sie fest, ob sie „ausgefüllt zurück“ kommen soll oder „nur zur Info“ dabei ist (z. B. eine Preisliste). Ohne eigene Nachricht schickt FallFlow einen kurzen Standardtext und nennt die benötigten Unterlagen. Nutzen Sie das nicht, überspringen Sie diesen Schritt einfach.
            </p>
            <ServiceMessagesPanel services={services} initialMessages={serviceMessages} initialTemplates={documentTemplates} canEdit profile={{ documents: profile.documents, documentsByService: profile.documentsByService }} />
            <AppointmentConfirmationCard initial={assistant} canEdit />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Wann können Sie Termine anbieten?</h1>
            <p className="text-sm text-muted-foreground">
              Sobald ein Fall vollständig ist, trägt die KI einen passenden freien Termin – nur an diesen Tagen, in diesem Zeitfenster – als Vorschlag in Ihren Kalender ein. Erst wenn Sie ihn bestätigen, schickt die KI die Bestätigung per Mail an den Kunden.
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

        {step === 5 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">Website verbinden</h1>
            <p className="text-sm text-muted-foreground">Optional. Sie können diesen Schritt auch später in den Einstellungen erledigen.</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Code kopieren.</li>
              <li>Vor dem schließenden &lt;/body&gt;-Tag Ihrer Website einfügen (bei Website-Baukästen im Bereich „Eigener Code“).</li>
              <li>Website neu laden – der Button „Fragen? Chat starten“ erscheint unten rechts.</li>
            </ol>
            <WidgetSnippet appUrl={appUrl} companyId={companyId} />
            <div className="flex items-center gap-2 rounded-xl bg-background px-4 py-3 text-sm">
              {widgetReceived ? <CheckCircle2 className="size-4 text-success" /> : <CircleDashed className="size-4 text-muted-foreground" />}
              {widgetReceived ? "Erste Widget-Nachricht empfangen." : "Status: Noch keine Widget-Nachricht empfangen. Sie können diesen Schritt überspringen."}
            </div>
            <a href={`/widget/${companyId}`} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-accent hover:underline">
              Widget in neuem Tab testen →
            </a>
            <div>
              <button type="button" onClick={next} className="text-sm font-medium text-muted-foreground hover:underline">
                Später erledigen →
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">WhatsApp (optional)</h1>
            <p className="text-sm text-muted-foreground">
              Ihre Kunden schreiben Ihnen lieber per WhatsApp? Dann beantwortet die KI auch dort die Anfragen – mit den Fragen, die Sie selbst festlegen. Sie können diesen Schritt auch später unter Einstellungen → Verbindungen erledigen.
            </p>
            <WhatsAppCard canEdit />
            <div>
              <button type="button" onClick={next} className="text-sm font-medium text-muted-foreground hover:underline">
                Später erledigen →
              </button>
            </div>
          </div>
        )}

        {step === 7 && (
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
              microsoftAvailable={connections.microsoftAvailable}
              returnTo="/onboarding"
              integrationResult={integrationResult}
              websiteConnected={false}
              showWebsite={false}
            />
            <div className="space-y-2 rounded-xl bg-accent-soft/50 p-4 text-sm">
              <p className="font-medium">Gut zu wissen</p>
              <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Testmail ausprobieren:</span> Unter KI-Assistent → Vorlagen & Nachrichten sehen Sie genau, was Ihre Kunden bekommen – ohne dass etwas verschickt wird.
                </li>
                <li>
                  <span className="font-medium text-foreground">Fragen beantworten Sie selbst:</span> Stellt ein Kunde eine Frage (z. B. zum Preis), antwortet die KI nicht. Sie bekommen eine E-Mail und finden die Anfrage im Posteingang unter „Aufmerksamkeit benötigt“.
                </li>
                <li>
                  <span className="font-medium text-foreground">Fertige Fälle:</span> Sobald alle Angaben und Unterlagen da sind, bekommen Sie ebenfalls eine E-Mail. Empfänger und Benachrichtigungen ändern Sie unter KI-Assistent → Einstellungen.
                </li>
              </ul>
            </div>
          </div>
        )}

        {error && <Notice tone="error" className="mt-4">{error}</Notice>}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || pending}>
            <ArrowLeft className="size-4" /> Zurück
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} loading={pending && step === STEPS.length - 2} disabled={(step === 1 && !company.name.trim()) || (step === 2 && (!profile.industry.trim() || profile.services.length === 0))}>
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
