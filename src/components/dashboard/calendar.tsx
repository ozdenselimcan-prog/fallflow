"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import type { Appointment } from "@/lib/data/types";
import { apiFetch, useMutation } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

interface Draft {
  id?: string;
  caseId: string | null;
  title: string;
  startsAt: string;
  durationMin: number;
  notes: string;
}

export function Calendar({ appointments, canWrite }: { appointments: Appointment[]; canWrite: boolean }) {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [draft, setDraft] = useState<Draft | null>(null);
  const { pending, error, setError, run } = useMutation();

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const k = dayKey(new Date(a.startsAt));
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return map;
  }, [appointments]);

  const days = useMemo(() => {
    if (view === "week") {
      const start = mondayOf(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = mondayOf(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  const shift = (dir: -1 | 1) => {
    const d = new Date(cursor);
    if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir, 1);
    setCursor(d);
  };

  const title =
    view === "month"
      ? cursor.toLocaleDateString("de-DE", { month: "long", year: "numeric" })
      : `${days[0].toLocaleDateString("de-DE", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}`;

  const openNew = (day: Date) => {
    setError(null);
    const d = new Date(day);
    d.setHours(10, 0, 0, 0);
    setDraft({ caseId: null, title: "", startsAt: toLocalInput(d), durationMin: 60, notes: "" });
  };
  const openEdit = (a: Appointment) => {
    setError(null);
    setDraft({ id: a.id, caseId: a.caseId, title: a.title, startsAt: toLocalInput(new Date(a.startsAt)), durationMin: a.durationMin, notes: a.notes });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = { ...draft, startsAt: new Date(draft.startsAt).toISOString() };
    const ok = await run(() => apiFetch(draft.id ? "PUT" : "POST", "/api/appointments", body));
    if (ok) setDraft(null);
  };

  const remove = async () => {
    if (!draft?.id) return;
    const ok = await run(() => apiFetch("DELETE", `/api/appointments?id=${encodeURIComponent(draft.id!)}`));
    if (ok) setDraft(null);
  };

  const today = dayKey(new Date());

  const chips = (day: Date) =>
    (byDay.get(dayKey(day)) ?? []).map((a) => (
      <button key={a.id} type="button" onClick={() => openEdit(a)} className="block w-full truncate rounded-md bg-accent-soft px-1.5 py-0.5 text-left text-xs text-accent hover:bg-accent hover:text-white">
        {time(a.startsAt)} {a.title}
      </button>
    ));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" aria-label="Zurück" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
            Heute
          </Button>
          <Button variant="secondary" size="sm" aria-label="Weiter" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-2 text-lg font-semibold capitalize">{title}</h2>
        </div>
        <div className="flex gap-2">
          <div className="inline-flex rounded-xl border border-border bg-card p-0.5" role="group" aria-label="Ansicht">
            {(["month", "week"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-1.5 text-sm", view === v ? "bg-accent text-white" : "text-muted-foreground")}>
                {v === "month" ? "Monat" : "Woche"}
              </button>
            ))}
          </div>
          {canWrite && (
            <Button size="sm" onClick={() => openNew(new Date())}>
              <Plus className="size-4" /> Termin
            </Button>
          )}
        </div>
      </div>

      {/* Desktop: Raster */}
      <Card className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-border bg-background text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const outside = view === "month" && d.getMonth() !== cursor.getMonth();
            return (
              <div key={d.toISOString()} className={cn("min-h-28 space-y-1 border-b border-r border-border p-1.5", outside && "bg-background/60", view === "week" && "min-h-64")}>
                <button type="button" disabled={!canWrite} onClick={() => openNew(d)} className={cn("flex size-6 items-center justify-center rounded-full text-xs", dayKey(d) === today ? "bg-accent font-semibold text-white" : outside ? "text-muted-foreground/50" : "hover:bg-muted")} aria-label={`Termin am ${d.toLocaleDateString("de-DE")} anlegen`}>
                  {d.getDate()}
                </button>
                {chips(d)}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Mobil: Agenda-Liste der sichtbaren Tage mit Terminen */}
      <div className="space-y-2 md:hidden">
        {days.filter((d) => byDay.has(dayKey(d)) && (view === "week" || d.getMonth() === cursor.getMonth())).length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Keine Termine in diesem Zeitraum.</p>
        )}
        {days
          .filter((d) => byDay.has(dayKey(d)) && (view === "week" || d.getMonth() === cursor.getMonth()))
          .map((d) => (
            <Card key={d.toISOString()} className="p-3">
              <p className="mb-2 text-sm font-medium">{d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
              <div className="space-y-1">{chips(d)}</div>
            </Card>
          ))}
      </div>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Termin bearbeiten" : "Termin erstellen"}>
        {draft && (
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={!canWrite} className="space-y-4">
              <Field label="Titel">
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={160} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Beginn (verschieben durch Ändern)">
                  <Input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} required />
                </Field>
                <Field label="Dauer (Min.)">
                  <Input type="number" min={5} max={1440} step={5} value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })} required />
                </Field>
              </div>
              <Field label="Notiz">
                <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={1000} />
              </Field>
            </fieldset>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="flex items-center justify-between gap-2">
              {draft.id && canWrite ? (
                <Button variant="ghost" onClick={remove} loading={pending}>
                  <Trash2 className="size-4 text-danger" /> Löschen
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Schließen
                </Button>
                {canWrite && (
                  <Button type="submit" loading={pending}>
                    Speichern
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
