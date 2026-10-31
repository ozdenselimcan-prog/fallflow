"use client";

import { CalendarCheck, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const TZ = "Europe/Berlin";
const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
// Tage kommen als Kalenderdatum (YYYY-MM-DD) – mit 12:00 UTC und UTC-Format bleibt der Tag in jeder Zeitzone gleich.
const weekdayShort = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" });
const dayShort = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "UTC" });

interface Props {
  token: string;
  days: { day: string; slots: string[] }[];
  current: { label: string; confirmed: boolean } | null;
  phone: string;
}

/** Auswahl der freien Termine auf der Buchungsseite – Tag wählen, Uhrzeit wählen, buchen. */
export function BookingPicker({ token, days, current, phone }: Props) {
  const [day, setDay] = useState(days[0]?.day ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string; confirmed: boolean } | null>(null);

  const label = (iso: string) => `${dayFmt.format(new Date(iso))} um ${timeFmt.format(new Date(iso))} Uhr`;

  const book = async () => {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: slot }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Buchung fehlgeschlagen");
      setDone({ label: label(slot), confirmed: Boolean(data.confirmed) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Buchung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Card className="mt-8 p-6 text-center">
        <CalendarCheck className="mx-auto size-10 text-success" />
        <p className="mt-3 text-lg font-semibold">{done.confirmed ? "Ihr Termin ist bestätigt" : "Ihr Wunschtermin ist vorgemerkt"}</p>
        <p className="mt-1 text-muted-foreground">{done.label}</p>
        <p className="mt-3 text-sm text-muted-foreground">{done.confirmed ? "Sie erhalten zusätzlich eine Bestätigung." : "Der Betrieb bestätigt Ihnen den Termin in Kürze."}</p>
      </Card>
    );
  }

  const slots = days.find((d) => d.day === day)?.slots ?? [];
  return (
    <div className="mt-8 space-y-6">
      {current && (
        <Notice tone="info">
          Ihr aktueller Termin: <strong>{current.label}</strong> ({current.confirmed ? "bestätigt" : "vorgemerkt"}). Wenn Sie unten einen anderen wählen, wird er ersetzt.
        </Notice>
      )}
      {days.length === 0 ? (
        <Notice tone="info">Gerade sind leider keine freien Termine eingetragen. Bitte melden Sie sich direkt{phone ? ` unter ${phone}` : ""}.</Notice>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm font-medium">Tag</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const date = new Date(`${d.day}T12:00:00Z`);
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => {
                      setDay(d.day);
                      setSlot(null);
                    }}
                    className={cn("shrink-0 rounded-xl border px-3 py-2 text-left text-sm", d.day === day ? "border-accent bg-accent-soft text-accent" : "border-border bg-card hover:bg-muted")}
                  >
                    <span className="block text-xs">{weekdayShort.format(date)}</span>
                    <span className="font-semibold">{dayShort.format(date)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Uhrzeit</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={cn("rounded-xl border px-3 py-2.5 text-sm font-medium tabular-nums", s === slot ? "border-accent bg-accent text-white" : "border-border bg-card hover:bg-muted")}
                >
                  {timeFmt.format(new Date(s))}
                </button>
              ))}
            </div>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button size="lg" className="w-full sm:w-auto" disabled={!slot} loading={busy} onClick={book}>
            <Check className="size-4" /> {slot ? `${label(slot)} buchen` : "Bitte eine Uhrzeit wählen"}
          </Button>
        </>
      )}
    </div>
  );
}
