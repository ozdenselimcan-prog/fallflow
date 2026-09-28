import type { Metadata } from "next";
import { SettingsBoard } from "@/components/dashboard/settings-board";
import { requireSession } from "@/lib/auth/session";
import { loadSettingsData } from "@/lib/dashboard/settings-data";
import { getStore } from "@/lib/data";

export const metadata: Metadata = { title: "Verbindungen" };

/**
 * Kanal-Verbindungen dieses Büros: jedes Büro verbindet seine eigenen Postfächer/Kanäle mit eigenen
 * Zugangsdaten (siehe connections-store.ts) – FallFlows globale Vercel-Variablen sind nur die
 * App-Identität für den OAuth-Handshake, nie Kunden-Zugangsdaten.
 */
export default async function ConnectionsPage({ searchParams }: PageProps<"/dashboard/settings/connections">) {
  const { integration } = await searchParams;
  const session = await requireSession();
  const data = await loadSettingsData(session, await getStore(session));
  return <SettingsBoard data={data} initialTab="connections" integrationNotice={integration === "not-ready"} />;
}
