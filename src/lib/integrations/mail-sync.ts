import { isCustomerInquiry } from "@/lib/ai/classify";
import { CASE_LIMIT_REACHED_TEXT } from "@/lib/billing/limits";
import { getPublicStore } from "@/lib/data";
import { CaseLimitReachedError } from "@/lib/intake/engine";
import { routeInbound } from "@/lib/intake/router";
import { listActiveConnections, saveConnection } from "./connections-store";
import type { MailSyncProvider } from "./email";
import { getValidTokens } from "./tokens";

/** Zuletzt verarbeitete Mail-IDs je Verbindung, um keine Mail doppelt zu bearbeiten (z. B. Gmails `after:`-Suche
 * ist nur tagesgenau und kann dieselbe Mail im nächsten Abruf erneut liefern; zusätzlich schützt das gegen
 * überlappende Abrufe, falls zwei Cron-Läufe sich zeitlich überschneiden). */
const SEEN_IDS_LIMIT = 300;

/**
 * Holt für alle verbundenen Postfächer eines Anbieters neue Nachrichten ab und verarbeitet sie über
 * dieselbe Pipeline wie der Website-Chat (Kunde/Fall erkennen, KI reagiert). Wird vom Cron aufgerufen
 * (kein Push-Webhook für Gmail/Microsoft in dieser Version).
 */
export async function syncMailbox(provider: MailSyncProvider): Promise<{ connections: number; messages: number; skipped: number; errors: number }> {
  const connections = await listActiveConnections(provider.id);
  let messages = 0;
  let skipped = 0;
  let errors = 0;

  for (const connection of connections) {
    try {
      const found = await getValidTokens(provider, connection.companyId);
      if (!found) continue;
      const store = await getPublicStore(connection.companyId);
      if (!store) continue;

      const seenIds = new Set<string>(Array.isArray(connection.metadata.seenMailIds) ? (connection.metadata.seenMailIds as string[]) : []);
      const inbound = await provider.fetchNewMessages(found.tokens, connection.lastSyncedAt);
      for (const mail of inbound) {
        if (seenIds.has(mail.externalId)) continue;
        seenIds.add(mail.externalId);
        const from = (mail.from.match(/<([^>]+)>/)?.[1] ?? mail.from).trim().toLowerCase();
        // Sicherheitsnetz gegen Endlosschleifen: eine Mail, die vom eigenen verbundenen Postfach kommt (z. B. eine
        // selbst versendete Antwort, die in Sent/Inbox auftaucht), ist keine Kundenanfrage.
        if (from === connection.accountEmail.trim().toLowerCase()) continue;
        if (/no.?reply|do.?not.?reply|mailer-daemon|postmaster/i.test(from)) continue;
        const fullText = `${mail.subject ? `${mail.subject}\n\n` : ""}${mail.body}`;
        // Grobe KI-Einschätzung: Newsletter, Rechnungen, interne Mails etc. lösen keinen Fall aus.
        if (!(await isCustomerInquiry(fullText))) {
          skipped++;
          continue;
        }
        try {
          await routeInbound(store, { companyId: connection.companyId, channel: "email", text: fullText.slice(0, 1500), sender: { email: from } });
          messages++;
        } catch (err) {
          if (err instanceof CaseLimitReachedError) {
            await provider.sendReply(found.tokens, from, "Re: Ihre Anfrage", CASE_LIMIT_REACHED_TEXT).catch(() => {});
            continue;
          }
          console.error(`[${provider.id}] Nachricht konnte nicht verarbeitet werden:`, err instanceof Error ? err.message : "unbekannt");
        }
      }
      const cappedSeenIds = [...seenIds].slice(-SEEN_IDS_LIMIT);
      await saveConnection({
        companyId: connection.companyId,
        provider: provider.id,
        status: "connected",
        lastSyncedAt: new Date().toISOString(),
        lastError: "",
        metadata: { ...connection.metadata, seenMailIds: cappedSeenIds },
      });
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : "Abruf fehlgeschlagen";
      console.error(`[${provider.id}] Abruf fehlgeschlagen für Büro ${connection.companyId}:`, message);
      await saveConnection({ companyId: connection.companyId, provider: provider.id, lastError: message }).catch(() => {});
    }
  }
  return { connections: connections.length, messages, skipped, errors };
}
