import { getPublicStore } from "@/lib/data";
import { routeInbound } from "@/lib/intake/router";
import { listActiveConnections, saveConnection } from "./connections-store";
import type { EmailProvider } from "./email";
import { getValidTokens } from "./tokens";

/**
 * Holt für alle verbundenen Postfächer eines Anbieters neue Nachrichten ab und verarbeitet sie über
 * dieselbe Pipeline wie WhatsApp (Kunde/Fall erkennen, KI reagiert). Wird vom Cron aufgerufen
 * (kein Push-Webhook für Gmail/Microsoft in dieser Version).
 */
export async function syncMailbox(provider: EmailProvider): Promise<{ connections: number; messages: number; errors: number }> {
  const connections = await listActiveConnections(provider.id);
  let messages = 0;
  let errors = 0;

  for (const connection of connections) {
    try {
      const found = await getValidTokens(provider, connection.companyId);
      if (!found) continue;
      const store = await getPublicStore(connection.companyId);
      if (!store) continue;

      const inbound = await provider.fetchNewMessages(found.tokens, connection.lastSyncedAt);
      for (const mail of inbound) {
        const from = mail.from.match(/<([^>]+)>/)?.[1] ?? mail.from;
        try {
          await routeInbound(store, { companyId: connection.companyId, channel: "email", text: `${mail.subject ? `${mail.subject}\n\n` : ""}${mail.body}`.slice(0, 1500), sender: { email: from } });
          messages++;
        } catch (err) {
          console.error(`[${provider.id}] Nachricht konnte nicht verarbeitet werden:`, err instanceof Error ? err.message : "unbekannt");
        }
      }
      await saveConnection({ companyId: connection.companyId, provider: provider.id, status: "connected", lastSyncedAt: new Date().toISOString(), lastError: "" });
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : "Abruf fehlgeschlagen";
      console.error(`[${provider.id}] Abruf fehlgeschlagen für Büro ${connection.companyId}:`, message);
      await saveConnection({ companyId: connection.companyId, provider: provider.id, lastError: message }).catch(() => {});
    }
  }
  return { connections: connections.length, messages, errors };
}
