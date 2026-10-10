import { can } from "@/lib/auth/permissions";
import type { Session } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getPlan, plans } from "@/lib/config/pricing";
import type { Store } from "@/lib/data/store";
import { listConnections, toStatus } from "@/lib/integrations/connections-store";

/**
 * Lädt alle Daten für den Einstellungsbereich (Profil, Unternehmen, Verbindungen, Abrechnung) in einem
 * Rutsch. Wird von jeder der vier Settings-Routen genutzt, damit der Tab-Wechsel danach komplett im
 * Browser läuft (siehe SettingsBoard) statt bei jedem Klick neu vom Server zu laden. Der KI-Assistent
 * hat eine eigene Seite (/dashboard/assistant) statt eines Reiters hier.
 */
export async function loadSettingsData(session: Session, store: Store) {
  const [company, connections, channels, subscription] = await Promise.all([store.getCompany(), listConnections(session.companyId), store.listChannels(), store.getSubscription()]);

  const byProvider = new Map(connections.map((c) => [c.provider, toStatus(c)]));
  const website = channels.find((c) => c.kind === "website")?.status === "connected";

  return {
    profile: { firstName: session.firstName, lastName: session.lastName, email: session.email },
    company: {
      name: company.name,
      website: company.website,
      phone: company.phone,
      address: company.address,
      services: company.services,
      foerderEnergyCertificate: company.foerderEnergyCertificate,
      foerderFloorplan: company.foerderFloorplan,
    },
    connections: {
      appUrl: siteConfig.appUrl,
      companyId: session.companyId,
      canManage: can(session.role, "company:manage"),
      gmail: byProvider.get("gmail") ?? null,
      websiteConnected: website,
    },
    billing: {
      subscription,
      plan: getPlan(subscription.plan),
      upgrades: plans.filter((p) => p.priceEur > getPlan(subscription.plan).priceEur),
      canManage: can(session.role, "billing:manage"),
      stripeReady: Boolean(process.env.STRIPE_SECRET_KEY),
    },
  };
}

export type SettingsData = Awaited<ReturnType<typeof loadSettingsData>>;
