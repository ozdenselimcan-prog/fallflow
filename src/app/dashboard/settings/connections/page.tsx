import type { Metadata } from "next";
import { ConnectionsPanel, type ConnectionView } from "@/components/dashboard/connections-panel";
import { Notice } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { siteConfig } from "@/lib/config/site";
import { getStore } from "@/lib/data";
import { listConnections, toStatus } from "@/lib/integrations/connections-store";
import { appConfigured as whatsappAppConfigured } from "@/lib/integrations/whatsapp";

export const metadata: Metadata = { title: "Verbindungen" };

/**
 * Kanal-Verbindungen dieses Büros: jedes Büro verbindet seine eigenen Postfächer/Kanäle mit eigenen
 * Zugangsdaten (siehe connections-store.ts) – FallFlows globale Vercel-Variablen sind nur die
 * App-Identität für den OAuth-Handshake, nie Kunden-Zugangsdaten.
 */
export default async function ConnectionsPage({ searchParams }: PageProps<"/dashboard/settings/connections">) {
  const { integration } = await searchParams;
  const session = await requireSession();
  const store = await getStore(session);
  const [channels, connections] = await Promise.all([store.listChannels(), listConnections(session.companyId)]);

  const byProvider = new Map(connections.map((c) => [c.provider, toStatus(c)]));
  const view = (p: "gmail" | "microsoft" | "whatsapp"): ConnectionView | null => byProvider.get(p) ?? null;
  const website = channels.find((c) => c.kind === "website")?.status === "connected";

  return (
    <div className="max-w-none">
      {integration === "not-ready" && (
        <div className="mb-4">
          <Notice>Die Anmeldung wurde empfangen, aber der Vorgang konnte nicht abgeschlossen werden. Bitte erneut versuchen.</Notice>
        </div>
      )}
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Jeder Kanal wird mit den eigenen Zugangsdaten Ihres Büros verbunden. FallFlow speichert diese Zugangsdaten verschlüsselt und ausschließlich für Ihr Büro – andere Kunden sehen sie nie.
      </p>
      <ConnectionsPanel
        appUrl={siteConfig.appUrl}
        companyId={session.companyId}
        canManage={can(session.role, "company:manage")}
        gmail={view("gmail")}
        microsoft={view("microsoft")}
        whatsapp={view("whatsapp")}
        whatsappAppConfigured={whatsappAppConfigured()}
        websiteConnected={website}
      />
    </div>
  );
}
