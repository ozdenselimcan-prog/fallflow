"use client";

import { BellRing, Check, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import type { FollowUp } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { formatDate, relativeDay } from "@/lib/utils";

interface Props {
  caseId: string;
  followUps: FollowUp[];
  canWrite: boolean;
  /** Kann ein Follow-up geplant werden? (Kontaktdaten vorhanden und noch etwas offen) */
  canPlan: boolean;
}

const statusBadge = (f: FollowUp) => {
  if (f.status === "planned") return <Badge tone="accent">Geplant {relativeDay(f.scheduledFor)}</Badge>;
  if (f.status === "manual") return <Badge tone="warning">Fällig – manuell senden</Badge>;
  if (f.status === "sent") return <Badge tone="success">Gesendet</Badge>;
  return <Badge>Abgebrochen</Badge>;
};

/** Automatische Follow-ups: geplante Nachfass-Nachrichten inkl. Text; ohne verbundenen Kanal sendet das Team selbst. */
export function FollowUpsPanel({ caseId, followUps, canWrite, canPlan }: Props) {
  const { pending, error, run } = useMutation();
  const shown = followUps.filter((f) => f.status !== "cancelled" || followUps.length <= 3);

  return (
    <Card>
      <CardHeader
        title="Follow-ups"
        description="Automatisches Nachfassen, wenn der Kunde Informationen nicht liefert"
        action={
          canWrite && canPlan && !followUps.some((f) => f.status === "planned" || f.status === "manual") ? (
            <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => apiFetch("POST", `/api/cases/${caseId}/follow-ups`, {}))}>
              <CalendarClock className="size-3.5" /> Follow-up planen
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-3 px-5 py-4">
        {error && <Notice tone="error">{error}</Notice>}
        {shown.length === 0 && <p className="text-sm text-muted-foreground">Kein Follow-up nötig oder geplant.</p>}
        {shown.map((f) => (
          <div key={f.id} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <BellRing className="size-4 text-muted-foreground" aria-hidden />
                {f.kind === "document" ? "Dokument-Erinnerung" : "Erinnerung an fehlende Angaben"}
              </p>
              {statusBadge(f)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {f.status === "sent" && f.sentAt ? `Gesendet am ${formatDate(f.sentAt)}` : `Vorgesehen für ${formatDate(f.scheduledFor)}`}
              {f.note ? ` · ${f.note}` : ""}
            </p>
            {(f.status === "planned" || f.status === "manual") && <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap">{f.message}</pre>}
            {canWrite && (f.status === "planned" || f.status === "manual") && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => apiFetch("PATCH", `/api/follow-ups/${f.id}`, { action: "mark_sent" }))}>
                  <Check className="size-3.5" /> Als gesendet markieren
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => apiFetch("PATCH", `/api/follow-ups/${f.id}`, { action: "cancel" }))}>
                  Abbrechen
                </Button>
              </div>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Follow-ups werden nur über einen verbundenen Kanal automatisch versendet. Solange E-Mail/WhatsApp nicht verbunden sind, erscheinen fällige Nachrichten hier zum manuellen Versand.
        </p>
      </div>
    </Card>
  );
}
