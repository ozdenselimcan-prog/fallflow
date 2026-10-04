"use client";

import { Check, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Plan } from "@/lib/config/pricing";
import { ConnectionsPanel } from "@/components/dashboard/connections-panel";
import { CompanyForm, ProfileForm } from "@/components/dashboard/settings-forms";
import { Button, buttonStyles } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/states";
import { cn, formatDate } from "@/lib/utils";
import type { SettingsData } from "@/lib/dashboard/settings-data";

// Der KI-Assistent hat eine eigene, vollwertige Seite mit Live-Vorschau (siehe /dashboard/assistant,
// in der Sidebar verlinkt) – kein eigener Reiter hier, um die Einstellung nicht doppelt zu pflegen.
export type SettingsTab = "profile" | "company" | "connections" | "billing";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profil" },
  { id: "company", label: "Unternehmen" },
  { id: "connections", label: "Verbindungen" },
  { id: "billing", label: "Abrechnung" },
];

const SUB_STATUS_LABELS = { trialing: "Testphase", active: "Aktiv", past_due: "Zahlung offen", canceled: "Gekündigt" } as const;

interface Props {
  data: SettingsData;
  initialTab: SettingsTab;
  integrationNotice?: boolean;
}

/**
 * Alle Einstellungs-Reiter (Profil, Unternehmen, Verbindungen, Assistent, Abrechnung) sind hier bereits
 * mit Daten geladen; der Wechsel zwischen ihnen ist ein reiner Zustandswechsel im Browser, ohne dass für
 * jeden Klick eine neue Serveranfrage nötig ist.
 */
export function SettingsBoard({ data, initialTab, integrationNotice }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const { plan, upgrades, subscription, canManage: canManageBilling, stripeReady } = data.billing;
  const hasStripeCustomer = Boolean(subscription.stripeCustomerId);

  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(subscription.cancelAtPeriodEnd);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  async function goToStripe(path: "/api/billing/checkout" | "/api/billing/portal", body?: { plan: Plan["id"] }) {
    setBillingError(null);
    setBillingBusy(true);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Aktion fehlgeschlagen");
      window.location.href = json.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Aktion fehlgeschlagen");
      setBillingBusy(false);
    }
  }

  async function setCancellation(cancel: boolean) {
    setBillingError(null);
    setBillingBusy(true);
    try {
      const res = await fetch(cancel ? "/api/billing/cancel" : "/api/billing/resume", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Aktion fehlgeschlagen");
      setCancelAtPeriodEnd(cancel);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Aktion fehlgeschlagen");
    } finally {
      setBillingBusy(false);
    }
  }

  return (
    <div>
      <nav aria-label="Einstellungen" className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium", tab === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={cn(tab === "connections" ? "max-w-none" : "max-w-3xl")}>
        {tab === "profile" && <ProfileForm {...data.profile} />}

        {tab === "company" && (
          <div className="space-y-4">
            <CompanyForm initial={data.company} canEdit={data.connections.canManage} />
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="font-semibold">PDF-Vorlagen & Nachrichtentexte</h2>
                <p className="text-sm text-muted-foreground">Werden jetzt beim KI-Assistenten gepflegt, zusammen mit den Fragen.</p>
              </div>
              <Link href="/dashboard/assistant/templates" className={buttonStyles({ variant: "secondary" })}>
                <FileText className="size-4" /> Vorlagen & Nachrichten
              </Link>
            </Card>
          </div>
        )}

        {tab === "connections" && (
          <>
            {integrationNotice && (
              <div className="mb-4">
                <Notice>Die Anmeldung wurde empfangen, aber der Vorgang konnte nicht abgeschlossen werden. Bitte erneut versuchen.</Notice>
              </div>
            )}
            <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
              Jeder Kanal wird mit den eigenen Zugangsdaten Ihres Büros verbunden. FallFlow speichert diese Zugangsdaten verschlüsselt und ausschließlich für Ihr Büro – andere Kunden sehen sie nie.
            </p>
            <ConnectionsPanel {...data.connections} />
          </>
        )}

        {tab === "billing" && (
          <div className="space-y-4">
            <Card>
              <CardHeader title="Aktueller Plan" action={<Badge tone="accent">{SUB_STATUS_LABELS[subscription.status]}</Badge>} />
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
                {subscription.currentPeriodEnd && <p className="text-sm text-muted-foreground">Aktuelle Periode bis {formatDate(subscription.currentPeriodEnd)}</p>}
                {cancelAtPeriodEnd && (
                  <Notice tone="info">
                    Gekündigt{subscription.currentPeriodEnd ? ` zum ${formatDate(subscription.currentPeriodEnd)}` : ""}. Bis dahin stehen alle Funktionen weiterhin zur Verfügung.
                  </Notice>
                )}
                {billingError && <p className="text-sm text-destructive">{billingError}</p>}
                {upgrades.length > 0 && canManageBilling && (
                  <div className="space-y-2">
                    <Button
                      disabled={!stripeReady || billingBusy}
                      title={stripeReady ? undefined : "Stripe ist noch nicht konfiguriert"}
                      onClick={() => goToStripe("/api/billing/checkout", { plan: upgrades[0].id })}
                    >
                      Auf {upgrades[0].name} upgraden
                    </Button>
                    {!stripeReady && <p className="text-xs text-muted-foreground">Die Zahlungsabwicklung (Stripe) ist vorbereitet, aber noch nicht aktiviert: STRIPE_SECRET_KEY und STRIPE_WEBHOOK_SECRET fehlen.</p>}
                  </div>
                )}
                {canManageBilling && hasStripeCustomer && (
                  <div>
                    {cancelAtPeriodEnd ? (
                      <Button variant="secondary" disabled={billingBusy} onClick={() => setCancellation(false)}>
                        Kündigung zurücknehmen
                      </Button>
                    ) : (
                      <Button variant="ghost" disabled={billingBusy} onClick={() => setCancelDialogOpen(true)}>
                        Vertrag kündigen
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Rechnungen" />
              <div className="space-y-3 p-5">
                {stripeReady && hasStripeCustomer && canManageBilling ? (
                  <Button variant="secondary" disabled={billingBusy} onClick={() => goToStripe("/api/billing/portal")}>
                    Zahlungsmethode & Rechnungen im Kundenportal öffnen
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Noch keine Rechnungen. Sobald ein Plan über Stripe gebucht wurde, erscheinen Zahlungsmethode und Rechnungen hier.</p>
                )}
              </div>
            </Card>

            <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} title="Vertrag kündigen?">
              <p className="text-sm text-muted-foreground">
                Ihr {plan.name}-Plan wird zum Ende der aktuellen Abrechnungsperiode{subscription.currentPeriodEnd ? ` (${formatDate(subscription.currentPeriodEnd)})` : ""} gekündigt. Bis dahin
                können Sie FallFlow weiterhin uneingeschränkt nutzen. Die Kündigung lässt sich bis dahin jederzeit zurücknehmen.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCancelDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button
                  variant="secondary"
                  disabled={billingBusy}
                  onClick={async () => {
                    await setCancellation(true);
                    setCancelDialogOpen(false);
                  }}
                >
                  Jetzt kündigen
                </Button>
              </div>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
