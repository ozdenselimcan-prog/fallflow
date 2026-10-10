"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { APPOINTMENT_PLACEHOLDER, DEFAULT_APPOINTMENT_CONFIRMED_TEMPLATE } from "@/lib/intake/scheduling";
import type { AssistantSettings } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";

/**
 * Nachricht an den Kunden, sobald ein Mitarbeiter einen von der KI vorgeschlagenen Termin bestätigt (oder
 * einen anderen Termin festlegt) – unabhängig von der Leistung, deshalb ein eigenes Feld statt eine Zeile
 * pro Leistung. "(Termin)" wird durch Datum/Uhrzeit ersetzt; lässt man den Platzhalter weg, nennt die KI
 * gar kein Datum per Mail (z. B. wenn das Büro danach lieber telefonisch Kontakt aufnimmt).
 */
export function AppointmentConfirmationCard({ initial, canEdit }: { initial: AssistantSettings; canEdit: boolean }) {
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useMutation();

  return (
    <Card>
      <CardHeader
        title="Terminbestätigung an den Kunden"
        description={`Wird verschickt, sobald ein Mitarbeiter den Termin bestätigt. Schreiben Sie dafür „${APPOINTMENT_PLACEHOLDER}“ in den Text – diese Klammer bitte nicht verändern, sonst wird das Datum nicht automatisch übernommen. Lassen Sie „${APPOINTMENT_PLACEHOLDER}“ ganz weg, wenn Sie kein Datum per Mail nennen wollen (z. B. weil Sie danach telefonisch Kontakt aufnehmen).`}
      />
      <div className="space-y-3 px-5 pb-5">
        <Textarea
          rows={2}
          disabled={!canEdit}
          placeholder={DEFAULT_APPOINTMENT_CONFIRMED_TEMPLATE}
          value={settings.appointmentConfirmedTemplate}
          onChange={(e) => {
            setSettings({ ...settings, appointmentConfirmedTemplate: e.target.value });
            setSaved(false);
          }}
        />
        {error && <Notice tone="error">{error}</Notice>}
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={async () => {
                const ok = await run(() => apiFetch("PUT", "/api/assistant", settings));
                if (ok) setSaved(true);
              }}
            >
              Speichern
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-success">
                <Check className="size-3.5" /> Gespeichert
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
