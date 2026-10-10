import { isCustomerInquiry } from "@/lib/ai/classify";
import { CASE_LIMIT_REACHED_TEXT } from "@/lib/billing/limits";
import { getPublicStore } from "@/lib/data";
import { CaseLimitReachedError } from "@/lib/intake/engine";
import { receiveFilledTemplate } from "@/lib/intake/case-ops";
import { findCaseByIdentity } from "@/lib/intake/identity";
import { routeInbound } from "@/lib/intake/router";
import { listActiveConnections, saveConnection } from "./connections-store";
import type { MailSyncProvider } from "./email";
import { getValidTokens } from "./tokens";

/** Zuletzt verarbeitete Mail-IDs je Verbindung, um keine Mail doppelt zu bearbeiten (z. B. Gmails `after:`-Suche
 * ist nur tagesgenau und kann dieselbe Mail im nächsten Abruf erneut liefern; zusätzlich schützt das gegen
 * überlappende Abrufe, falls zwei Cron-Läufe sich zeitlich überschneiden). */
const SEEN_IDS_LIMIT = 300;

const CONCURRENCY = 10;

/** Zerlegt eine "From"-Kopfzeile ("Max Mustermann <max@example.com>") in Anzeigename und Adresse. */
function parseFromHeader(raw: string): { email: string; name: string } {
  const match = raw.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  const email = (match ? match[2] : raw).trim().toLowerCase();
  const name = (match ? match[1] : "").trim();
  return { email, name };
}

/**
 * Holt für alle verbundenen Postfächer eines Anbieters neue Nachrichten ab und verarbeitet sie über
 * dieselbe Pipeline wie der Website-Chat (Kunde/Fall erkennen, KI reagiert). Wird vom Cron aufgerufen
 * (kein Push-Webhook für IMAP-Postfächer).
 */
export async function syncMailbox(provider: MailSyncProvider): Promise<{ connections: number; messages: number; skipped: number; errors: number }> {
  const connections = await listActiveConnections(provider.id);
  let messages = 0;
  let skipped = 0;
  let errors = 0;

  // Jede Verbindung braucht eine eigene IMAP-Verbindung – mit wachsender Buero-Anzahl waere ein rein
  // sequentieller Durchlauf zu langsam fuers Function-Timeout. Begrenzte Parallelitaet statt alle auf einmal.
  for (let i = 0; i < connections.length; i += CONCURRENCY) {
    await Promise.all(connections.slice(i, i + CONCURRENCY).map(processConnection));
  }

  async function processConnection(connection: (typeof connections)[number]) {
    try {
      const found = await getValidTokens(provider, connection.companyId);
      if (!found) return;
      const store = await getPublicStore(connection.companyId);
      if (!store) return;

      const seenIds = new Set<string>(Array.isArray(connection.metadata.seenMailIds) ? (connection.metadata.seenMailIds as string[]) : []);
      // Nach jeder Mail sofort sichern (nicht erst am Ende aller Mails dieses Postfachs): bricht der Cron-Lauf
      // vorzeitig ab (z. B. Function-Timeout bei vielen Büros), wird eine bereits beantwortete Mail beim
      // naechsten Lauf sonst faelschlich nochmal als neu erkannt und ein zweites Mal beantwortet.
      const persistSeenIds = () => {
        const cappedSeenIds = [...seenIds].slice(-SEEN_IDS_LIMIT);
        return saveConnection({
          companyId: connection.companyId,
          provider: provider.id,
          status: "connected",
          lastSyncedAt: new Date().toISOString(),
          lastError: "",
          metadata: { ...connection.metadata, seenMailIds: cappedSeenIds },
        });
      };

      const inbound = await provider.fetchNewMessages(found.tokens, connection.lastSyncedAt);
      for (const mail of inbound) {
        if (seenIds.has(mail.externalId)) continue;
        seenIds.add(mail.externalId);
        const { email: from, name: fromName } = parseFromHeader(mail.from);
        // Sicherheitsnetz gegen Endlosschleifen: eine Mail, die vom eigenen verbundenen Postfach kommt (z. B. eine
        // selbst versendete Antwort, die in Sent/Inbox auftaucht), ist keine Kundenanfrage.
        if (from === connection.accountEmail.trim().toLowerCase()) continue;
        if (/no.?reply|do.?not.?reply|mailer-daemon|postmaster/i.test(from)) continue;
        // Markiert sich die Mail selbst als automatisch versendet (RFC 3834), nie beantworten – sonst entsteht
        // eine Endlosschleife, z. B. mit einer Abwesenheitsnotiz oder einem ANDEREN Büro, das ebenfalls
        // FallFlow nutzt und dessen Antwort hier sonst fälschlich als neue Kundenanfrage ankäme.
        if (mail.autoSubmitted) {
          skipped++;
          await persistSeenIds();
          continue;
        }
        // Zusätzliches Sicherheitsnetz, falls die Gegenseite den Auto-Submitted-Header nicht setzt (nicht
        // jedes System hält sich daran): Hat der zugehörige Fall in den letzten 10 Minuten schon auffällig
        // viele automatische Antworten bekommen, nicht weiter automatisch antworten – vermutlich eine
        // Mail-Schleife. Das Team wird per Ereignis informiert und übernimmt manuell.
        const existing = findCaseByIdentity(await store.listCases(), { email: from });
        if (existing) {
          const tenMinutesAgo = Date.now() - 10 * 60_000;
          const recentAutoReplies = (await store.listMessages(existing.id)).filter((m) => m.role === "assistant" && Date.parse(m.createdAt) > tenMinutesAgo).length;
          if (recentAutoReplies >= 5) {
            await store.addEvent(existing.id, "note", "Auffällig viele automatische Antworten in kurzer Zeit erkannt (möglicherweise eine Mail-Schleife) – automatische Antworten für diesen Fall vorerst pausiert, bitte manuell prüfen.");
            skipped++;
            await persistSeenIds();
            continue;
          }
        }
        const fullText = `${mail.subject ? `${mail.subject}\n\n` : ""}${mail.body}`;
        // Ein PDF-Anhang (z. B. die ausgefüllt zurückgeschickte Vollmacht) ist eindeutig fallrelevant, auch
        // wenn der Mailtext selbst knapp ist ("siehe Anhang") – dann die KI-Einschätzung nicht erst fragen.
        const hasPdfAttachment = mail.attachments.length > 0;
        if (!hasPdfAttachment && !(await isCustomerInquiry(fullText))) {
          skipped++;
          await persistSeenIds();
          continue;
        }
        try {
          const { turn } = await routeInbound(store, {
            companyId: connection.companyId,
            channel: "email",
            text: fullText.slice(0, 1500),
            sender: { email: from, name: fromName || undefined },
          });
          messages++;
          for (const att of mail.attachments) {
            await receiveFilledTemplate(store, turn.sessionId, att.bytes, att.filename).catch((err) => {
              console.error(`[${provider.id}] Vorlagen-Rückläufer konnte nicht verarbeitet werden:`, err instanceof Error ? err.message : "unbekannt");
            });
          }
        } catch (err) {
          if (err instanceof CaseLimitReachedError) {
            await provider.sendReply(found.tokens, from, "Re: Ihre Anfrage", CASE_LIMIT_REACHED_TEXT).catch(() => {});
          } else {
            console.error(`[${provider.id}] Nachricht konnte nicht verarbeitet werden:`, err instanceof Error ? err.message : "unbekannt");
          }
        }
        await persistSeenIds();
      }
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : "Abruf fehlgeschlagen";
      console.error(`[${provider.id}] Abruf fehlgeschlagen für Büro ${connection.companyId}:`, message);
      // Status auf "error" setzen (nicht nur lastError speichern): sonst zeigt die Oberfläche weiterhin
      // "Verbunden" an, obwohl jeder Abruf fehlschlägt (z. B. veraltete Zugangsdaten von vor der
      // IMAP-Umstellung) – das Büro bekommt den Fehler sonst nie zu sehen.
      await saveConnection({ companyId: connection.companyId, provider: provider.id, status: "error", lastError: message }).catch(() => {});
    }
  }
  return { connections: connections.length, messages, skipped, errors };
}
