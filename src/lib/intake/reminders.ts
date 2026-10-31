import { attentionOf } from "@/lib/cases/attention";
import { customerText } from "@/lib/config/customer-texts";
import type { Store } from "@/lib/data/store";
import type { CaseRecord } from "@/lib/data/types";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { emailSubjectFor, frameEmail, refreshCase } from "./case-ops";

/**
 * Automatische Erinnerungen per E-Mail: Wartet ein Fall auf den Kunden (es fehlen noch Angaben oder Unterlagen) und hat
 * der Kunde seit der letzten Nachricht des Büros nicht geantwortet, erinnert FallFlow nach 2 und nach 5 Tagen. Danach
 * wird der Fall als „keine Rückmeldung“ vermerkt. Abschaltbar unter KI-Assistent (Automatik), Texte unter „Texte“.
 * Nur E-Mail: WhatsApp erlaubt nach 24 Stunden keine freien Nachrichten mehr.
 */
const DAY = 24 * 60 * 60 * 1000;
export const FIRST_REMINDER_DAYS = 2;
export const SECOND_REMINDER_DAYS = 5;
const NO_RESPONSE_DAYS = 10;

/** Nur zwischen 8 und 19 Uhr (deutsche Zeit) erinnern – nicht nachts. */
export function isDaytimeInGermany(now: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Berlin" }).formatToParts(now).find((p) => p.type === "hour")?.value ?? "12");
  return hour >= 8 && hour < 19;
}

/** Welche Erinnerung ist für diesen Fall jetzt fällig? (null = keine) */
export function dueReminder(c: CaseRecord, lastMessage: { role: string; createdAt: string } | undefined, now: Date): "first" | "second" | "noResponse" | null {
  if (c.status !== "WAITING_FOR_CUSTOMER" || attentionOf(c.fields) || !c.fields.email) return null;
  if (c.source === "whatsapp" || c.fields.noResponse) return null;
  // Letzte Nachricht muss vom Büro bzw. der KI sein – hat der Kunde zuletzt geschrieben, ist nichts zu erinnern.
  if (!lastMessage || lastMessage.role === "user") return null;
  const since = now.getTime() - new Date(lastMessage.createdAt).getTime();
  const count = Number(c.fields.reminderCount ?? "0");
  if (count === 0 && since >= FIRST_REMINDER_DAYS * DAY) return "first";
  if (count === 1 && since >= (SECOND_REMINDER_DAYS - FIRST_REMINDER_DAYS) * DAY) return "second";
  if (count >= 2 && since >= (NO_RESPONSE_DAYS - SECOND_REMINDER_DAYS) * DAY) return "noResponse";
  return null;
}

/** Fällige Erinnerungen eines Betriebs verschicken. Gibt die Zahl der verschickten Erinnerungen zurück. */
export async function sendReminders(store: Store, now = new Date()): Promise<number> {
  if (!isDaytimeInGermany(now)) return 0;
  const [company, settings] = await Promise.all([store.getCompany(), store.getAssistant()]);
  if (!settings.autoReply || company.businessProfile?.automation?.reminders === false) return 0;
  let sent = 0;
  for (const c of await store.listCases()) {
    if (c.status !== "WAITING_FOR_CUSTOMER" || c.source === "whatsapp") continue;
    const messages = await store.listMessages(c.id);
    const due = dueReminder(c, messages.at(-1), now);
    if (!due) continue;
    if (due === "noResponse") {
      await store.updateCase(c.id, { fields: { noResponse: "1" }, keepTimestamp: true });
      await store.addEvent(c.id, "note", "Keine Rückmeldung des Kunden nach zwei Erinnerungen.");
      continue;
    }
    const { checklist } = await refreshCase(store, c.id, { touch: false });
    const missing = checklist.missing.map((i) => i.label);
    if (!missing.length) continue;
    const body = customerText(company.businessProfile?.texts, due === "first" ? "reminder.first" : "reminder.second", {
      leistung: c.fields.service || "Ihrer Anfrage",
      liste: missing.join(", "),
    });
    const text = await frameEmail(store, body, c.fields.name);
    const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email: c.fields.email, text, subject: await emailSubjectFor(store, c.fields.service) });
    await store.addMessage(c.id, "assistant", text, { channel: "email", delivery: result.delivered ? "delivered" : "not_sent" });
    await store.updateCase(c.id, { fields: { reminderCount: due === "first" ? "1" : "2" }, keepTimestamp: true });
    await store.addEvent(c.id, "note", `${due === "first" ? "Erste" : "Zweite"} Erinnerung an den Kunden ${result.delivered ? "gesendet" : "vorbereitet (nicht versendet)"}.`);
    sent++;
  }
  return sent;
}

/**
 * Bitte um eine Bewertung: am Tag nach einem bestätigten Termin (frühestens 20 Stunden nach Terminende, höchstens 7 Tage
 * danach) einmal per E-Mail – nur, wenn der Betrieb es eingeschaltet und einen Bewertungslink hinterlegt hat.
 */
const REVIEW_AFTER_MS = 20 * 60 * 60 * 1000;
const REVIEW_WINDOW_MS = 7 * DAY;

export function reviewDue(appt: { startsAt: string; durationMin: number; status: string }, c: Pick<CaseRecord, "fields">, now: Date): boolean {
  if (appt.status !== "confirmed" || !c.fields.email || c.fields.reviewAsked) return false;
  const since = now.getTime() - (new Date(appt.startsAt).getTime() + appt.durationMin * 60_000);
  return since >= REVIEW_AFTER_MS && since <= REVIEW_WINDOW_MS;
}

export async function sendReviewRequests(store: Store, now = new Date()): Promise<number> {
  if (!isDaytimeInGermany(now)) return 0;
  const company = await store.getCompany();
  const { reviews, reviewLink } = company.businessProfile?.automation ?? {};
  if (!reviews || !reviewLink) return 0;
  let sent = 0;
  for (const appt of await store.listAppointments()) {
    if (!appt.caseId) continue;
    const c = await store.getCase(appt.caseId);
    if (!c || !reviewDue(appt, c, now)) continue;
    const body = customerText(company.businessProfile?.texts, "review.request", { bewertungslink: reviewLink });
    // Mit "-" abgeschaltet: als erledigt merken, damit nicht bei jedem Durchlauf erneut geprüft wird.
    if (!body) {
      await store.updateCase(c.id, { fields: { reviewAsked: "1" }, keepTimestamp: true });
      continue;
    }
    // Eigener Text ohne Platzhalter: Link trotzdem mitschicken.
    const text = await frameEmail(store, body.includes(reviewLink) ? body : `${body}\n\n${reviewLink}`, c.fields.name);
    const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email: c.fields.email, text, subject: `Vielen Dank – ${company.name}` });
    await store.addMessage(c.id, "assistant", text, { channel: "email", delivery: result.delivered ? "delivered" : "not_sent" });
    await store.updateCase(c.id, { fields: { reviewAsked: "1" }, keepTimestamp: true });
    await store.addEvent(c.id, "note", `Bitte um Bewertung ${result.delivered ? "gesendet" : "vorbereitet (nicht versendet)"}.`);
    sent++;
  }
  return sent;
}
