"use client";

import { CalendarPlus, Mail, UserCheck } from "lucide-react";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import type { CaseStatus } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";

interface Props {
  caseId: string;
  customerName: string;
  email: string;
  status: CaseStatus;
  canWrite: boolean;
}

const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function CaseActions({ caseId, customerName, email, status, canWrite }: Props) {
  const { pending, error, run } = useMutation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`Erstgespräch ${customerName}`);
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [notes, setNotes] = useState("");

  const patch = (body: object) => run(() => apiFetch("PATCH", `/api/cases/${caseId}`, body));
  const mailto = email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Ihre Anfrage zur Energieberatung")}` : undefined;
  const ready = status === "READY_FOR_REVIEW" || status === "COMPLETE";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => patch({ assign: true })} loading={pending} disabled={!canWrite || status === "CONVERTED"} variant={ready ? "primary" : "secondary"}>
          <UserCheck className="size-4" /> {status === "CONVERTED" ? "Fall übernommen" : "Fall übernehmen"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(true)} disabled={!canWrite}>
          <CalendarPlus className="size-4" /> Termin vorschlagen
        </Button>
        {mailto ? (
          <a href={mailto} className={buttonStyles({ variant: "secondary" })}>
            <Mail className="size-4" /> E-Mail
          </a>
        ) : (
          <Button variant="secondary" disabled title="Keine E-Mail-Adresse erfasst">
            <Mail className="size-4" /> E-Mail
          </Button>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}

      <Dialog open={open} onClose={() => setOpen(false)} title="Termin vorschlagen">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run(() => apiFetch("POST", "/api/appointments", { caseId, title, startsAt: new Date(startsAt).toISOString(), durationMin: 60, notes }));
            if (ok) setOpen(false);
          }}
        >
          <Field label="Titel">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
          </Field>
          <Field label="Beginn">
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </Field>
          <Field label="Notiz (optional)">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </Field>
          <p className="text-xs text-muted-foreground">Der Termin wird als „vorgeschlagen“ angelegt, bis der Kunde bestätigt hat. Die Terminübermittlung an den Kunden erfolgt über Ihren gewohnten Weg.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" loading={pending}>
              Termin anlegen
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
