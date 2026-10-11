"use client";

import { Check, Loader2, Lock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { plans } from "@/lib/config/pricing";
import { apiFetch } from "@/lib/use-api";
import { cn } from "@/lib/utils";

/**
 * Wird statt des Dashboards gezeigt, solange ein neues Büro noch keine Zahlungsmethode hinterlegt hat (Bezahlseite bei
 * der Registrierung abgebrochen). Startet die 7-tägige Testphase über Stripe.
 */
export function PaymentSetup({ canManage }: { canManage: boolean }) {
  const confirming = useSearchParams().get("checkout") === "success";
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (plan: string) => {
    setError(null);
    setPending(plan);
    try {
      const { url } = await apiFetch<{ url: string }>("POST", "/api/billing/start-trial", { plan });
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Bezahlseite konnte nicht geöffnet werden.");
      setPending(null);
    }
  };

  if (confirming) {
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <LiveRefresh active everyMs={2000} />
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-hidden />
        <p className="mt-3 font-semibold">Vielen Dank! Ihre Testphase wird gerade aktiviert …</p>
        <p className="mt-1 text-sm text-muted-foreground">Das dauert nur wenige Sekunden – die Seite lädt automatisch neu.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Starten Sie Ihre kostenlose Testphase</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Damit FallFlow für Ihr Büro arbeitet – E-Mails beantworten, Fälle vorbereiten, Website-Chat –, hinterlegen Sie bitte einmal eine Zahlungsmethode. Die ersten 7 Tage sind kostenlos und
          jederzeit kündbar; vor Ablauf der Testphase wird nichts abgebucht.
        </p>
      </div>
      {!canManage ? (
        <Notice className="mx-auto mt-6 max-w-xl">Die Testphase kann nur der Inhaber bzw. ein Admin Ihres Büros starten.</Notice>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <li key={p.id}>
              <Card className={cn("flex h-full flex-col p-5", p.highlighted && "border-accent")}>
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1">
                  <span className="text-2xl font-semibold">{p.priceEur} €</span>
                  <span className="text-sm text-muted-foreground"> / Monat nach der Testphase</span>
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-4 w-full" variant={p.highlighted ? "primary" : "secondary"} loading={pending === p.id} disabled={pending !== null} onClick={() => start(p.id)}>
                  7 Tage kostenlos testen
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {error && <Notice tone="error" className="mx-auto mt-4 max-w-xl">{error}</Notice>}
    </div>
  );
}
