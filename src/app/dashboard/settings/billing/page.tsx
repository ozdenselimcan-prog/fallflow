import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { getPlan, plans } from "@/lib/config/pricing";
import { getStore } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Abrechnung" };

const STATUS = { trialing: "Testphase", active: "Aktiv", past_due: "Zahlung offen", canceled: "Gekündigt" } as const;

export default async function BillingPage() {
  const session = await requireSession();
  const sub = await (await getStore(session)).getSubscription();
  const plan = getPlan(sub.plan);
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY);
  const upgrades = plans.filter((p) => p.priceEur > plan.priceEur);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Aktueller Plan" action={<Badge tone="accent">{STATUS[sub.status]}</Badge>} />
        <div className="space-y-4 p-5">
          <p>
            <span className="text-2xl font-semibold">{plan.name}</span>
            <span className="ml-2 text-muted-foreground">{plan.priceEur} €/Monat</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="size-4 text-accent" /> {f}
              </li>
            ))}
          </ul>
          {sub.currentPeriodEnd && <p className="text-sm text-muted-foreground">Aktuelle Periode bis {formatDate(sub.currentPeriodEnd)}</p>}
          {upgrades.length > 0 && can(session.role, "billing:manage") && (
            <div className="space-y-2">
              <Button disabled={!stripeReady} title={stripeReady ? undefined : "Stripe ist noch nicht konfiguriert"}>
                Auf {upgrades[0].name} upgraden
              </Button>
              {!stripeReady && <p className="text-xs text-muted-foreground">Die Zahlungsabwicklung (Stripe) ist vorbereitet, aber noch nicht aktiviert: STRIPE_SECRET_KEY und STRIPE_WEBHOOK_SECRET fehlen.</p>}
            </div>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Rechnungen" />
        <p className="p-5 text-sm text-muted-foreground">Noch keine Rechnungen. Sobald die Zahlungsabwicklung aktiv ist, erscheinen Rechnungen hier.</p>
      </Card>
    </div>
  );
}
