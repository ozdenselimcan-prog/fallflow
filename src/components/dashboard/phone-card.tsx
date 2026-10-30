"use client";

import { Phone, PhoneForwarded } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";
import { formatDateTime } from "@/lib/utils";

interface PhoneInfo {
  number: string | null;
  minutesUsed: number;
  includedMinutes: number;
  plan: "starter" | "pro" | "business";
  calls: { id: string; from: string; startedAt: string; durationSec: number; caseId: string | null; status: string }[];
}

const pretty = (n: string) => n.replace(/^\+49(\d{2,4})(\d+)$/, "0$1 $2");
const duration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} Min.` : `${s} Sek.`);

/** Telefon-Assistent: FallFlow-Nummer, Anleitung zur Rufumleitung, verbrauchte Minuten und letzte Anrufe. */
export function PhoneCard() {
  const [info, setInfo] = useState<PhoneInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PhoneInfo>("GET", "/api/phone/settings")
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "Konnte nicht geladen werden"));
  }, []);

  const usedUp = info ? info.includedMinutes > 0 && info.minutesUsed >= info.includedMinutes : false;

  return (
    <Card className="mt-4">
      <CardHeader
        title="Telefon-Assistent"
        description="Die KI nimmt Anrufe an, fragt die nötigen Angaben ab und legt den Fall an – wie bei E-Mails."
        action={info?.number ? <Badge tone="success">Aktiv</Badge> : <Badge>Noch nicht eingerichtet</Badge>}
      />
      <div className="space-y-4 p-5 text-sm">
        {error && <Notice tone="error">{error}</Notice>}
        {!info && !error && <p className="text-muted-foreground">Wird geladen …</p>}
        {info && info.includedMinutes === 0 && (
          <p className="text-muted-foreground">
            Der Telefon-Assistent ist ab dem Tarif Pro enthalten (120 Minuten pro Monat).{" "}
            <Link href="/dashboard/settings/billing" className="font-medium text-accent hover:underline">
              Tarif ändern
            </Link>
          </p>
        )}
        {info && info.includedMinutes > 0 && !info.number && (
          <p className="text-muted-foreground">
            Für Ihren Betrieb ist noch keine FallFlow-Telefonnummer eingerichtet. Schreiben Sie uns, dann richten wir Ihnen eine Nummer ein.
          </p>
        )}
        {info?.number && (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
              <Phone className="size-5 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="text-xs text-muted-foreground">Ihre FallFlow-Nummer</p>
                <p className="text-lg font-semibold tabular-nums">{pretty(info.number)}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <PhoneForwarded className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="space-y-1.5">
                <p className="font-medium">So leiten Sie Anrufe weiter</p>
                <p className="text-muted-foreground">
                  Ihre bekannte Nummer bleibt. Richten Sie in Ihrem Telefon bzw. bei Ihrem Telefonanbieter eine Rufumleitung auf die FallFlow-Nummer ein – am besten
                  „bei Besetzt oder wenn niemand rangeht“. Dann gehen Sie selbst ran, wenn Sie können, und sonst übernimmt die KI.
                </p>
                <p className="text-muted-foreground">
                  Am Handy meist: <span className="font-mono">**61*{info.number}#</span> (nach ca. 20 Sekunden ohne Annahme) bzw. <span className="font-mono">**67*{info.number}#</span> (bei
                  Besetzt). Bei Festnetz-Anlagen (z. B. FRITZ!Box) im Menü „Rufumleitung“.
                </p>
              </div>
            </div>
          </>
        )}
        {info && info.includedMinutes > 0 && (
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Minuten in diesem Monat</span>
              <span className="font-semibold tabular-nums">
                {info.minutesUsed} / {info.includedMinutes}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className={usedUp ? "h-full bg-warning" : "h-full bg-accent"} style={{ width: `${Math.min(100, (info.minutesUsed / info.includedMinutes) * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {info.includedMinutes} Minuten pro Monat inklusive, ohne Zusatzkosten. Sind sie verbraucht, nimmt die KI bis zum Monatsende keine Anrufe mehr an – Anrufe
              klingeln dann wie gewohnt bei Ihnen bzw. gehen auf Ihre Mailbox. Angefangene Minuten zählen als volle Minute.
            </p>
            {usedUp && (
              <Notice tone="info" className="mt-3">
                Die Minuten für diesen Monat sind verbraucht.{" "}
                {info.plan === "pro" && (
                  <Link href="/dashboard/settings/billing" className="font-medium underline">
                    Mehr Minuten im Tarif Business
                  </Link>
                )}
              </Notice>
            )}
          </div>
        )}
        {info && info.calls.length > 0 && (
          <div>
            <p className="mb-2 font-medium">Letzte Anrufe</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {info.calls.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    {c.from ? pretty(c.from) : "Unterdrückte Nummer"} · <span className="text-muted-foreground">{formatDateTime(c.startedAt)}</span>
                  </span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    {duration(c.durationSec)}
                    {c.caseId && (
                      <Link href={`/dashboard/cases/${c.caseId}`} className="font-medium text-accent hover:underline">
                        Fall ansehen
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
