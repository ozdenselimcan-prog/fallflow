"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { TONE_LABELS } from "@/lib/cases/fields";
import { TONES, type AssistantSettings } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";

const TOGGLES: { key: keyof Pick<AssistantSettings, "autoReply" | "autoFollowUp" | "appointmentBooking" | "humanHandoff">; label: string; hint: string }[] = [
  { key: "autoReply", label: "Automatische Antworten", hint: "Der Assistent antwortet auf neue Anfragen selbstständig." },
  { key: "autoFollowUp", label: "Automatische Rückfragen", hint: "Fehlende Angaben werden im Gespräch nachgefragt." },
  { key: "appointmentBooking", label: "Terminbuchung", hint: "Kunden können nach einem vollständigen Fall einen Termin wünschen." },
  { key: "humanHandoff", label: "Human Handoff", hint: "Auf Wunsch oder bei Unsicherheit wird an einen Mitarbeiter übergeben." },
];

export function AssistantForm({ initial, canEdit }: { initial: AssistantSettings; canEdit: boolean }) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useMutation();
  const set = <K extends keyof AssistantSettings>(k: K, v: AssistantSettings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  return (
    <Card>
      <CardHeader title="Einstellungen" description="Diese Angaben gelten für Website-Chat und Vorschau." />
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
