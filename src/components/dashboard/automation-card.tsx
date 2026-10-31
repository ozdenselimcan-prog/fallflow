"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";
import { PushToggle } from "./push-toggle";

interface Automation {
  reminders: boolean;
  autoConfirm: boolean;
  bookingLink: boolean;
  reviews: boolean;
  reviewLink: string;
  multilingual: boolean;
}

/** KI-Assistent → Automatik: Erinnerungen an Kunden und automatische Terminbestätigung (wird sofort gespeichert). */
export function AutomationCard({ canEdit }: { canEdit: boolean }) {
  const [a, setA] = useState<Automation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  useEffect(() => {
    apiFetch<Automation>("GET", "/api/automation")
      .then((r) => {
        setA(r);
        setLink(r.reviewLink);
      })
      .catch(() => setError("Konnte nicht geladen werden"));
  }, []);

  const toggle = async (patch: Partial<Automation>) => {
    if (!a) return;
    const next = { ...a, ...patch };
    setA(next);
    setError(null);
    try {
      setA(await apiFetch<Automation>("PUT", "/api/automation", next));
    } catch (e) {
      setA(a);
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  };

  return (
    <Card>
      <CardHeader title="Automatik" description="Was FallFlow ohne Ihr Zutun erledigt. Änderungen gelten sofort." />
      <div className="space-y-4 p-5 text-sm">
        {error && <Notice tone="error">{error}</Notice>}
        {!a && !error && <p className="text-muted-foreground">Wird geladen …</p>}
        {a && (
          <>
            <div>
              <Checkbox label="Kunden automatisch erinnern" checked={a.reminders} disabled={!canEdit} onChange={(v) => toggle({ reminders: v })} />
              <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                Fehlen nach einer Antwort noch Angaben oder Unterlagen, erinnert FallFlow den Kunden per E-Mail nach 2 und nach 5 Tagen. Die Texte ändern Sie unter „Texte“.
              </p>
            </div>
            <div>
              <Checkbox label="Kunden wählen ihren Termin selbst (Buchungslink)" checked={a.bookingLink} disabled={!canEdit} onChange={(v) => toggle({ bookingLink: v })} />
              <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                Sind alle Angaben da, bekommt der Kunde einen Link zu Ihren freien Terminen und bucht mit einem Klick. Aus: FallFlow schlägt selbst einen Termin vor.
              </p>
            </div>
            <div>
              <Checkbox label="Termine automatisch bestätigen" checked={a.autoConfirm} disabled={!canEdit} onChange={(v) => toggle({ autoConfirm: v })} />
              <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                Aus: FallFlow schlägt Termine vor, Sie bestätigen sie im Kalender. An: Freie Termine (laut Ihren Zeiten und verbundenem Outlook-Kalender) werden sofort fest
                vergeben und dem Kunden bestätigt.
              </p>
            </div>
            <div>
              <Checkbox label="In der Sprache des Kunden antworten" checked={a.multilingual} disabled={!canEdit} onChange={(v) => toggle({ multilingual: v })} />
              <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                Schreibt ein Kunde z. B. auf Englisch, Türkisch oder Polnisch, gehen die automatischen Antworten übersetzt in seiner Sprache raus. Im Fall können Sie seine
                Nachrichten auf Deutsch anzeigen und selbst auf Deutsch antworten – FallFlow übersetzt.
              </p>
            </div>
            <div>
              <Checkbox
                label="Nach dem Termin um eine Google-Bewertung bitten"
                checked={a.reviews}
                disabled={!canEdit || !a.reviewLink}
                onChange={(v) => toggle({ reviews: v })}
              />
              <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                Am Tag nach einem bestätigten Termin bekommt der Kunde einmal eine freundliche E-Mail mit Ihrem Bewertungslink. Den Link finden Sie in Ihrem Google-Unternehmensprofil
                unter „Nach Rezensionen fragen“. Den Text ändern Sie unter „Texte“.
              </p>
              <div className="mt-2 px-1">
                <Input
                  type="url"
                  value={link}
                  disabled={!canEdit}
                  placeholder="https://g.page/r/…/review"
                  aria-label="Link zur Google-Bewertung"
                  onChange={(e) => setLink(e.target.value)}
                  onBlur={() => {
                    const v = link.trim();
                    if (v !== a.reviewLink) void toggle({ reviewLink: v, reviews: v ? a.reviews || !a.reviewLink : false });
                  }}
                />
              </div>
            </div>
            <PushToggle />
          </>
        )}
      </div>
    </Card>
  );
}
