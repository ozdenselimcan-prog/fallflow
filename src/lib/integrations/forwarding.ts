import { randomBytes } from "node:crypto";
import { simpleParser } from "mailparser";
import { getPublicStore } from "@/lib/data";
import { needsPaymentSetup } from "@/lib/billing/access";
import { createAdminClient } from "@/lib/supabase/clients";
import { getConnection, saveConnection, type Connection } from "./connections-store";
import { FROM_ADDRESS, forwardingAddress, INBOUND_DOMAIN, sendAsCompany } from "./forward-send";
import { toInboundEmail } from "./gmail";
import { processInboundMail } from "./mail-sync";

/**
 * Weiterleitung statt Postfach-Verbindung: Jeder Betrieb bekommt eine eigene Adresse (z. B. huber-k3f9@in.fallflow.eu)
 * und leitet in seinem Postfach eine Kopie aller neuen Mails dorthin weiter – ohne Passwort, ohne Server-Einstellungen.
 * Die Mails nimmt ein kleiner Mailserver auf dem FallFlow-Server an (deploy/mail-inbound.mjs) und reicht sie an
 * /api/inbound/email weiter. Antworten an Kunden verschickt FallFlow selbst über Resend – mit dem Namen des Betriebs als
 * Absender und seiner eigenen Adresse als Antwortadresse, damit Kunden wie gewohnt beim Betrieb landen.
 *
 * Gespeichert wird das als Verbindung "forward" (Tabelle connections): metadata.address = Teil vor dem @,
 * accountEmail = die Adresse des Betriebs, die die Kunden kennen; status "connected" = eingeschaltet.
 */

const SEEN_LIMIT = 300;
const RECENT_LIMIT = 5;

export interface ForwardingInfo {
  /** Vollständige FallFlow-Adresse, an die der Betrieb weiterleitet. */
  address: string;
  /** Die Adresse des Betriebs, an die die Kunden schreiben (Antwortadresse). */
  ownAddress: string;
  active: boolean;
  lastReceivedAt: string | null;
  /** Gmail verlangt beim Einrichten der Weiterleitung einen Bestätigungscode – den zeigen wir dem Betrieb an. */
  gmailCode: { code: string; link: string; at: string } | null;
  /** Die letzten empfangenen Mails (nur Absender/Betreff), damit der Betrieb sieht, dass die Weiterleitung ankommt. */
  recent: { from: string; subject: string; at: string; handled: boolean }[];
  /** Kann FallFlow überhaupt selbst Mails verschicken (RESEND_API_KEY gesetzt)? */
  sendingAvailable: boolean;
}

export function toForwardingInfo(c: Connection): ForwardingInfo {
  const m = c.metadata;
  return {
    address: forwardingAddress(c),
    ownAddress: c.accountEmail,
    active: c.status === "connected",
    lastReceivedAt: c.lastSyncedAt,
    gmailCode: (m.gmailCode as ForwardingInfo["gmailCode"]) ?? null,
    recent: Array.isArray(m.recent) ? (m.recent as ForwardingInfo["recent"]) : [],
    sendingAvailable: Boolean(process.env.RESEND_API_KEY),
  };
}

/** "Dachdeckerei Huber GmbH" → "dachdeckerei-huber" (nur a–z, 0–9 und Bindestriche, höchstens 24 Zeichen). */
export function slugForAddress(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\b(gmbh|ug|kg|ohg|gbr|e\.?k\.?|mbh|co)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
  return slug || "betrieb";
}

/** Holt die Weiterleitung des Betriebs und legt beim ersten Aufruf eine eigene Adresse an (noch ausgeschaltet). */
export async function ensureForwarding(companyId: string, companyName: string, defaultOwnAddress: string): Promise<Connection> {
  const existing = await getConnection(companyId, "forward");
  if (existing?.metadata.address) return existing;
  // Zufälliger Zusatz: Die Adresse soll sich nicht erraten lassen, sonst könnte jeder Mails in die Fallakten schicken.
  const address = `${slugForAddress(companyName)}-${randomBytes(3).toString("hex")}`;
  await saveConnection({ companyId, provider: "forward", status: "disconnected", accountName: companyName, accountEmail: defaultOwnAddress.toLowerCase(), metadata: { address } });
  const created = await getConnection(companyId, "forward");
  if (!created) throw new Error("Weiterleitung konnte nicht angelegt werden.");
  return created;
}

async function findByAddress(local: string): Promise<Connection | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.from("connections").select("company_id").eq("provider", "forward").eq("metadata->>address", local).maybeSingle();
  if (error || !data) return null;
  return getConnection(data.company_id as string, "forward");
}

/** Gmail schickt beim Einrichten einer Weiterleitung eine Mail mit Bestätigungscode an die neue Adresse. */
export function gmailConfirmation(from: string, subject: string, body: string): { code: string; link: string } | null {
  if (!/forwarding-noreply@google\.com/i.test(from)) return null;
  const code = subject.match(/#(\d{6,12})/)?.[1] ?? body.match(/(?:code|Bestätigungscode)[^\d]{0,40}(\d{6,12})/i)?.[1] ?? "";
  const link = body.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/vf-[^\s<>"')\]]+/)?.[0] ?? "";
  return code || link ? { code, link } : null;
}

/** Je Betrieb nacheinander verarbeiten: Antwortet ein Kunde, kommt seine Mail oft doppelt an (direkt an die
 * FallFlow-Adresse und als Weiterleitung) – ohne diese Reihenfolge würden beide gleichzeitig als neu gelten. */
const queues = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(fn);
  const settled = run.catch(() => {});
  queues.set(key, settled);
  void settled.then(() => {
    if (queues.get(key) === settled) queues.delete(key);
  });
  return run;
}

export { INBOUND_DOMAIN };

export type ForwardResult = "unknown-recipient" | "ok";

/** Eine an die FallFlow-Adresse(n) zugestellte Mail (Rohdaten) annehmen und wie eine Mail aus dem Postfach bearbeiten. */
export async function receiveForwardedMail(recipients: string[], raw: Buffer): Promise<ForwardResult> {
  const locals = [...new Set(recipients.map((r) => r.trim().toLowerCase()).filter((r) => r.endsWith(`@${INBOUND_DOMAIN}`)).map((r) => r.slice(0, -INBOUND_DOMAIN.length - 1)))];
  let found = false;
  for (const local of locals) {
    const conn = await findByAddress(local);
    if (!conn) continue;
    found = true;
    await serialized(conn.companyId, () => handleForCompany(conn.companyId, raw));
  }
  return found ? "ok" : "unknown-recipient";
}

async function handleForCompany(companyId: string, raw: Buffer): Promise<void> {
  // Stand neu laden (nicht den von vor der Warteschlange nehmen), sonst gehen gesehene Mails verloren.
  const conn = await getConnection(companyId, "forward");
  if (!conn) return;
  const parsed = await simpleParser(raw);
  const mail = toInboundEmail(parsed, parsed.messageId ?? `fwd:${Date.now()}`);
  const now = new Date().toISOString();
  const meta = { ...conn.metadata };
  const seen = Array.isArray(meta.seen) ? (meta.seen as string[]) : [];
  const save = (handled: boolean) => {
    const recent = [{ from: mail.from.slice(0, 120), subject: mail.subject.slice(0, 120), at: now, handled }, ...(Array.isArray(meta.recent) ? (meta.recent as ForwardingInfo["recent"]) : [])].slice(0, RECENT_LIMIT);
    return saveConnection({ companyId, provider: "forward", lastSyncedAt: now, metadata: { ...meta, seen: seen.slice(-SEEN_LIMIT), recent } });
  };

  const confirm = gmailConfirmation(mail.from, mail.subject, mail.body);
  if (confirm) {
    meta.gmailCode = { ...confirm, at: now };
    await save(false);
    return;
  }
  // Dieselbe Mail nicht zweimal bearbeiten (Kundenantwort direkt + per Weiterleitung, erneute Zustellung).
  if (mail.messageId) {
    if (seen.includes(mail.messageId)) return;
    seen.push(mail.messageId);
  }
  // Erst wenn der Betrieb die Weiterleitung eingeschaltet hat, wird geantwortet – vorher nur anzeigen, dass Mails ankommen.
  if (conn.status !== "connected") {
    await save(false);
    return;
  }
  const store = await getPublicStore(companyId);
  if (!store) return;
  // Abo beendet oder Testphase ohne Zahlungsmethode abgelaufen: wie beim Postfach-Abruf nichts mehr beantworten.
  const [subscription, company] = await Promise.all([store.getSubscription(), store.getCompany()]);
  if (subscription.status === "canceled" || needsPaymentSetup(company, subscription)) {
    await save(false);
    return;
  }
  // Vor der Bearbeitung sichern: Bricht etwas ab, wird die Mail bei einer erneuten Zustellung nicht doppelt beantwortet.
  await save(false);
  const result = await processInboundMail(store, companyId, mail, {
    ownAddresses: [conn.accountEmail, forwardingAddress(conn), FROM_ADDRESS],
    unwrapFrom: conn.accountEmail,
    sendLimitReply: (to, text) => sendAsCompany(conn, company.name, { to, subject: "Re: Ihre Anfrage", body: text }),
    label: "forward",
  });
  if (result === "handled") {
    const latest = await getConnection(companyId, "forward");
    const recent = Array.isArray(latest?.metadata.recent) ? [...(latest.metadata.recent as ForwardingInfo["recent"])] : [];
    if (recent[0]) recent[0] = { ...recent[0], handled: true };
    await saveConnection({ companyId, provider: "forward", metadata: { ...(latest?.metadata ?? meta), recent } });
  }
}
