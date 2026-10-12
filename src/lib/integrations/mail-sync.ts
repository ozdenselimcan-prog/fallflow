import { CASE_LIMIT_REACHED_TEXT } from "@/lib/billing/limits";
import { getPublicStore } from "@/lib/data";
import { CaseLimitReachedError } from "@/lib/intake/engine";
import { findCaseByIdentity } from "@/lib/intake/identity";
import { needsPaymentSetup } from "@/lib/billing/access";
import { listActiveConnections, saveConnection } from "./connections-store";
import type { MailSyncProvider } from "./email";
import { unwrapForwardedMail } from "./forwarded";
import { handleInboundMail } from "./inbound-mail";
import { getValidTokens } from "./tokens";

/** Zuletzt verarbeitete Mail-IDs je Verbindung, um keine Mail doppelt zu bearbeiten (z. B. Gmails `after:`-Suche
 * ist nur tagesgenau und kann dieselbe Mail im nächsten Abruf erneut liefern; zusätzlich schützt das gegen
 * überlappende Abrufe, falls zwei Cron-Läufe sich zeitlich überschneiden). */
const SEEN_IDS_LIMIT = 600;

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
      // Abo beendet: keine Mails mehr abrufen oder beantworten (der Vertrag ist vorbei, die Daten werden bald gelöscht).
      const [subscription, company] = await Promise.all([store.getSubscription(), store.getCompany()]);
      if (subscription.status === "canceled") return;
      // Neues Büro ohne Zahlungsmethode (Bezahlseite abgebrochen): erst nach Start der Testphase.
      if (needsPaymentSetup(company, subscription)) return;

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
        // Neben der Ordner-ID auch die Message-ID merken: Wird eine Mail aus dem Junk-Ordner in den Posteingang
        // verschoben, bekommt sie dort eine neue ID – sie darf aber nicht ein zweites Mal bearbeitet werden.
        const keys = [mail.externalId, ...(mail.messageId ? [`mid:${mail.messageId}`] : [])];
        if (keys.some((k) => seenIds.has(k))) {
          keys.forEach((k) => seenIds.add(k));
          continue;
        }
        keys.forEach((k) => seenIds.add(k));
        let { email: from, name: fromName } = parseFromHeader(mail.from);
        // Weiterleitung (z. B. Outlook → Gmail) per „WG:“-Regel: die Mail kommt scheinbar von der eigenen Büro-Adresse,
        // der echte Kunde steht im Text – herausholen. Lässt sich keiner finden, ist es eine eigene Mail des Büros.
        const replyTo = typeof connection.metadata.replyTo === "string" ? connection.metadata.replyTo.toLowerCase() : "";
        if (replyTo && from === replyTo) {
          const original = unwrapForwardedMail(mail.subject, mail.body);
          if (!original || original.from === replyTo || original.from === connection.accountEmail.trim().toLowerCase()) continue;
          from = original.from;
          fromName = original.fromName;
          mail.subject = original.subject;
          mail.body = original.body;
        }
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
        try {
          const outcome = await handleInboundMail(
            store,
            connection.companyId,
            { from, fromName, subject: mail.subject, body: mail.body, attachments: mail.attachments, skippedAttachments: mail.skippedAttachments },
            { junk: mail.junk },
          );
          if (outcome.handled) messages++;
          else skipped++;
        } catch (err) {
          if (err instanceof CaseLimitReachedError) {
            // Mails aus dem Junk-Ordner bekommen nie eine automatische Antwort (könnte Spam sein).
            if (!mail.junk) await provider.sendReply(found.tokens, from, "Re: Ihre Anfrage", CASE_LIMIT_REACHED_TEXT).catch(() => {});
          } else {
            console.error(`[${provider.id}] Nachricht konnte nicht verarbeitet werden:`, err instanceof Error ? err.message : "unbekannt");
          }
        }
        await persistSeenIds();
      }
      // Auch ohne neue Mails festhalten, dass der Abruf geklappt hat ("Zuletzt synchronisiert", Betreiber-Übersicht).
      await persistSeenIds();
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
