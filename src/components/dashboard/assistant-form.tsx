"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { TONE_LABELS, WEEKDAY_LABELS } from "@/lib/cases/fields";
import { TONES, type AssistantSettings } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const TOGGLES: { key: keyof Pick<AssistantSettings, "autoReply" | "autoFollowUp" | "appointmentBooking" | "humanHandoff">; label: string; hint: string }[] = [
  { key: "autoReply", label: "Automatische Antworten", hint: "Der Assistent antwortet auf neue Anfragen selbstständig." },
  { key: "autoFollowUp", label: "Automatische Rückfragen", hint: "Fehlende Angaben werden im Gespräch nachgefragt." },
  { key: "appointmentBooking", label: "Terminvorschlag", hint: "Sobald ein Fall vollständig ist, fragt die KI nach Wunschtagen und schlägt selbstständig einen freien Termin vor." },
  { key: "humanHandoff", label: "Human Handoff", hint: "Auf Wunsch oder bei Unsicherheit wird an einen Mitarbeiter übergeben." },
];

/** Reihenfolge Mo–So in der Anzeige, intern 0 (So) – 6 (Sa) wie JS Date.getDay(). */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function AssistantForm({ initial, canEdit }: { initial: AssistantSettings; canEdit: boolean }) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useMutation();
  const set = <K extends keyof AssistantSettings>(k: K, v: AssistantSettings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const toggleDay = (day: number) => {
    const has = s.workingDays.includes(day);
    const next = has ? s.workingDays.filter((d) => d !== day) : [...s.workingDays, day];
    set("workingDays", next.sort((a, b) => a - b));
  };

  return (
    <Card>
      <CardHeader title="Einstellungen" description="Diese Angaben gelten für Website-Chat, E-Mail und Vorschau." />
      <form
        className="space-y-5 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run(() => apiFetch("PUT", "/api/assistant", s));
          if (ok) setSaved(true);
        }}
      >
        <fieldset disabled={!canEdit || pending} className="space-y-5">
          <Field label="Name des Assistenten">
            <Input value={s.name} onChange={(e) => set("name", e.target.value)} maxLength={40} required />
          </Field>
          <Field label="Begrüßung">
            <Textarea value={s.greeting} onChange={(e) => set("greeting", e.target.value)} maxLength={300} required />
          </Field>
          <Field label="Ton">
            <Select value={s.tone} onChange={(e) => set("tone", e.target.value as AssistantSettings["tone"])}>
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {TONE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {TOGGLES.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.hint}</p>
                </div>
                <Switch checked={s[t.key]} onChange={(v) => set(t.key, v)} label={t.label} />
              </li>
            ))}
          </ul>

          {s.appointmentBooking && (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Verfügbarkeit für Terminvorschläge</p>
              <p className="text-xs text-muted-foreground">
                Die KI schlägt Termine nur an diesen Wochentagen und innerhalb dieser Uhrzeit vor – und nur an Tagen, die der Kunde selbst nennt (z. B. „Dienstag bis Sonntag“).
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Verfügbare Wochentage">
                {DISPLAY_ORDER.map((day) => {
                  const active = s.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl border text-sm font-medium transition-colors",
                        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {WEEKDAY_LABELS[day]}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Von">
                  <Input type="time" value={s.slotStart} onChange={(e) => set("slotStart", e.target.value)} required />
                </Field>
                <Field label="Bis">
                  <Input type="time" value={s.slotEnd} onChange={(e) => set("slotEnd", e.target.value)} required />
                </Field>
                <Field label="Termindauer (Min.)">
                  <Input type="number" min={15} max={480} step={15} value={s.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value))} required />
                </Field>
                <Field label="Max. Termine pro Tag" hint="Leer lassen für unbegrenzt (nur durch das Zeitfenster begrenzt).">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    placeholder="unbegrenzt"
                    value={s.maxAppointmentsPerDay ?? ""}
                    onChange={(e) => set("maxAppointmentsPerDay", e.target.value ? Number(e.target.value) : null)}
                  />
                </Field>
              </div>
            </div>
          )}
        </fieldset>
        <p className="rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
          Der Assistent sammelt ausschließlich Angaben, ordnet Anliegen ein und bereitet Termine vor. Er gibt keine verbindliche Energie-, Förder- oder Rechtsberatung und leitet bei Unsicherheit an Ihr Team weiter.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {saved && <Notice tone="success">Gespeichert.</Notice>}
        {canEdit ? (
          <Button type="submit" loading={pending}>
            Speichern
          </Button>
        ) : (
          <Notice>Nur Inhaber und Admins können den Assistenten ändern.</Notice>
        )}
      </form>
    </Card>
  );
}
