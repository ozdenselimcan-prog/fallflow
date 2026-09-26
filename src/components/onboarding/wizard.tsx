"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { WidgetSnippet } from "@/components/dashboard/widget-snippet";
import { SERVICES } from "@/lib/cases/fields";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn } from "@/lib/utils";

interface Props {
  firstName: string;
  companyId: string;
  appUrl: string;
  initial: { name: string; website: string; phone: string; address: string; services: string[] };
  fieldOptions: { key: string; label: string; active: boolean }[];
  widgetReceived: boolean;
}

const STEPS = ["Willkommen", "Unternehmen", "Leistungen", "Erfassungsfelder", "Website verbinden"];

export function OnboardingWizard({ firstName, companyId, appUrl, initial, fieldOptions, widgetReceived }: Props) {
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({ name: initial.name, website: initial.website, phone: initial.phone, address: initial.address });
  const [services, setServices] = useState<string[]>(initial.services);
  const [active, setActive] = useState<string[]>(fieldOptions.filter((f) => f.active).map((f) => f.key));
  const { pending, error, run } = useMutation();

  const toggle = (list: string[], value: string, on: boolean) => (on ? [...list, value] : list.filter((x) => x !== value));

  const finish = async () => {
    const ok = await run(
      () => apiFetch("POST", "/api/onboarding", { ...company, services, activeFieldKeys: active }),
      { refresh: false },
    );
    // Volles Neuladen statt Client-Navigation: sonst kann eine zwischengespeicherte Weiterleitung zurück ins Onboarding führen.
    if (ok) window.location.href = "/dashboard";
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
              In vier kurzen Schritten richten wir Ihr Büro ein: Firmendaten, Ihre Leistungen, die Angaben für neue Fälle und das Website-Widget. Alles lässt sich später in den Einstellungen ändern.
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
            <h1 className="text-2xl font-semibold tracking-tight">Welche Informationen benötigen Sie?</h1>
            <p className="text-sm text-muted-foreground">Deaktivierte Angaben fragt der Assistent nicht ab. Pflichtangaben und Reihenfolge passen Sie später im Frage-Flow an.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {fieldOptions.map((f) => (
                <Checkbox key={f.key} label={f.label} checked={active.includes(f.key)} onChange={(on) => setActive(toggle(active, f.key, on))} />
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
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
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || pending}>
            <ArrowLeft className="size-4" /> Zurück
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !company.name.trim()}>
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
