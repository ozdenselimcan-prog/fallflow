"use client";

import { Check, Loader2, Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
export function PaymentSetup({ canManage, preferredPlan, trialDays = 7 }: { canManage: boolean; preferredPlan?: string; trialDays?: number }) {
  const router = useRouter();
  const confirming = useSearchParams().get("checkout") === "success";
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "busy" | "none">("idle");

  // Zurück von Stripe, aber noch kein Abo hinterlegt (z. B. Webhook verspätet): einmal direkt bei Stripe nachsehen.
  const sync = async () => {
    setSyncState("busy");
    const res = await apiFetch<{ found: boolean }>("POST", "/api/billing/sync").catch(() => ({ found: false }));
    if (res.found) router.refresh();
    else setSyncState("none");
  };
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => void sync(), 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirming]);

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

  if (confirming && syncState !== "none") {
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <LiveRefresh active everyMs={2000} />
        <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-hidden />
        <p className="mt-3 font-semibold">Vielen Dank! Ihre Testphase wird gerade aktiviert …</p>
        <p className="mt-1 text-sm text-muted-foreground">Das dauert nur wenige Sekunden – die Seite lädt automatisch neu.</p>
        {syncState === "idle" && (
          <button type="button" onClick={() => void sync()} className="mt-4 text-sm font-medium underline">
            Status jetzt prüfen
          </button>
        )}
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="text-center">
        <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Starten Sie Ihre kostenlose Testphase</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Fast geschafft! Damit FallFlow für Ihr Büro arbeitet – E-Mails beantworten, Fälle vorbereiten, Website-Chat –, hinterlegen Sie bitte einmal eine Zahlungsmethode. Die ersten {trialDays} Tage sind
          kostenlos und jederzeit kündbar; vor Ablauf der Testphase wird nichts abgebucht.
        </p>
      </div>
      {syncState === "none" && (
        <Notice tone="error" className="mx-auto mt-6 max-w-xl">
          Bei Stripe haben wir noch kein Abo für Ihr Büro gefunden. Falls Sie gerade bezahlt haben, versuchen Sie es in einer Minute erneut – sonst wählen Sie unten Ihren Plan.
        </Notice>
      )}
      {!canManage ? (
        <Notice className="mx-auto mt-6 max-w-xl">Die Testphase kann nur der Inhaber bzw. ein Admin Ihres Büros starten.</Notice>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <li key={p.id}>
              <Card className={cn("flex h-full flex-col p-5", (preferredPlan ? p.id === preferredPlan : p.highlighted) && "border-accent")}>
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
                <Button
                  className="mt-4 w-full"
                  variant={(preferredPlan ? p.id === preferredPlan : p.highlighted) ? "primary" : "secondary"}
                  loading={pending === p.id}
                  disabled={pending !== null}
                  onClick={() => start(p.id)}
                >
                  {trialDays} Tage kostenlos testen
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {error && <Notice tone="error" className="mx-auto mt-4 max-w-xl">{error}</Notice>}
      {canManage && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Bereits bezahlt?{" "}
          <button type="button" className="underline" disabled={syncState === "busy"} onClick={() => void sync()}>
            Status bei Stripe prüfen
          </button>
        </p>
      )}
    </div>
  );
}
