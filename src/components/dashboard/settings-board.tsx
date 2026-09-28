"use client";

import { Check, ListChecks } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AssistantForm } from "@/components/dashboard/assistant-form";
import { ConnectionsPanel } from "@/components/dashboard/connections-panel";
import { CompanyForm, ProfileForm } from "@/components/dashboard/settings-forms";
import { Button, buttonStyles } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { cn, formatDate } from "@/lib/utils";
import type { SettingsData } from "@/lib/dashboard/settings-data";

export type SettingsTab = "profile" | "company" | "connections" | "assistant" | "billing";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profil" },
  { id: "company", label: "Unternehmen" },
  { id: "connections", label: "Verbindungen" },
  { id: "assistant", label: "Assistent" },
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
  const { plan, upgrades, subscription, canManage: canManageBilling, stripeReady } = data.billing;

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

        {tab === "company" && <CompanyForm initial={data.company} canEdit={data.connections.canManage} />}

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

        {tab === "assistant" && (
          <div className="space-y-4">
            <AssistantForm initial={data.assistant.initial} canEdit={data.assistant.canEdit} />
            <Link href="/dashboard/assistant/questions" className={buttonStyles({ variant: "secondary" })}>
              <ListChecks className="size-3.5" /> Frage-Flow bearbeiten
            </Link>
          </div>
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
                {upgrades.length > 0 && canManageBilling && (
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
        )}
      </div>
    </div>
  );
}
