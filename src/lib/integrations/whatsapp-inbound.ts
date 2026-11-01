import { transcribeAudio } from "@/lib/ai/transcribe";
import { customerText } from "@/lib/config/customer-texts";
import { getPublicStore } from "@/lib/data";
import type { Store } from "@/lib/data/store";
import { sniffMime } from "@/lib/documents/storage";
import { receiveCaseDocument, refreshCase } from "@/lib/intake/case-ops";
import { CaseLimitReachedError } from "@/lib/intake/engine";
import { findCaseByIdentity } from "@/lib/intake/identity";
import { routeInbound } from "@/lib/intake/router";
import { findWhatsAppConnection, saveConnection, type Connection } from "./connections-store";
import { AI_PAUSED_KEY } from "@/lib/intake/engine";
import { downloadMedia, markRead, parseCoexistence, parseWebhook, sendWhatsAppText, type CoexistenceEvents, type WhatsAppInbound } from "./whatsapp";

/**
 * Verarbeitet einen WhatsApp-Webhook: jede Nachricht dem Betrieb (über die Telefonnummer-ID) und dem Kunden-Fall
 * (über die Handynummer) zuordnen und wie im Website-Chat beantworten – eine Frage nach der anderen. Fotos und PDFs
 * landen in der Fallakte. Meta schickt Webhooks bei Zeitüberschreitung erneut – bereits verarbeitete Nachrichten
 * (ID) werden übersprungen.
 */
export async function handleWhatsAppWebhook(body: unknown): Promise<void> {
  for (const ev of parseCoexistence(body)) await handleCoexistence(ev).catch((err) => console.error("[whatsapp] Coexistence:", err instanceof Error ? err.message : "unbekannt"));
  for (const group of parseWebhook(body)) {
    const conn = await findWhatsAppConnection(group.phoneNumberId);
    if (!conn?.accessToken) continue;
    const store = await getPublicStore(conn.companyId);
    if (!store) continue;
    const seen: string[] = Array.isArray(conn.metadata.seen) ? (conn.metadata.seen as string[]) : [];
    const fresh = group.messages.filter((m) => m.id && !seen.includes(m.id));
    if (!fresh.length) continue;
    // Zuerst merken, dann verarbeiten – ein erneut zugestellter Webhook läuft so nicht doppelt.
    await saveConnection({ companyId: conn.companyId, provider: "whatsapp", metadata: { ...conn.metadata, seen: [...seen, ...fresh.map((m) => m.id)].slice(-200) }, lastSyncedAt: new Date().toISOString() });
    const known = new Set(knownContactsOf(conn));
    const cases = known.size ? await store.listCases() : [];
    for (const m of fresh) {
      // Nummer läuft parallel in der WhatsApp-Business-App: bestehende Kontakte ohne laufende Anfrage beantwortet der
      // Betrieb wie gewohnt selbst – FallFlow bleibt still (auch keine Lesebestätigung).
      if (known.has(digits(m.from)) && !findCaseByIdentity(cases, { phone: `+${digits(m.from)}` })) continue;
      await markRead(conn.accessToken, group.phoneNumberId, m.id);
      await handleMessage(store, conn, group.phoneNumberId, m).catch((err) => console.error("[whatsapp] Nachricht nicht verarbeitet:", err instanceof Error ? err.message : "unbekannt"));
    }
  }
}

const digits = (phone: string) => phone.replace(/\D/g, "");
const knownContactsOf = (conn: Connection): string[] => (Array.isArray(conn.metadata.knownContacts) ? (conn.metadata.knownContacts as string[]) : []);
const MAX_KNOWN = 5000;

/**
 * Coexistence: Adressbuch und frühere Chats merken (diese Kontakte beantwortet der Betrieb selbst). Schreibt der Betrieb
 * in der App, landet die Nachricht im Fall und die KI hält sich in diesem Chat zurück.
 */
async function handleCoexistence(ev: CoexistenceEvents): Promise<void> {
  const conn = await findWhatsAppConnection(ev.phoneNumberId);
  if (!conn) return;
  const store = await getPublicStore(conn.companyId);
  if (!store) return;
  const known = new Set(knownContactsOf(conn));
  for (const c of ev.contacts) {
    if (c.remove) known.delete(digits(c.phone));
    else known.add(digits(c.phone));
  }
  for (const h of ev.historyContacts) known.add(digits(h));
  const seen: string[] = Array.isArray(conn.metadata.seen) ? (conn.metadata.seen as string[]) : [];
  const echoes = ev.echoes.filter((e) => !seen.includes(e.id));
  if (echoes.length) {
    const cases = await store.listCases();
    for (const e of echoes) {
      const c = findCaseByIdentity(cases, { phone: `+${digits(e.to)}` });
      if (!c) {
        // Der Betrieb chattet selbst mit jemandem ohne Anfrage – da soll die KI später nicht dazwischengehen.
        known.add(digits(e.to));
        continue;
      }
      await store.addMessage(c.id, "staff", e.text.slice(0, 2000), { channel: "whatsapp", delivery: "delivered" });
      if (c.fields[AI_PAUSED_KEY] !== "1") {
        await store.updateCase(c.id, { fields: { [AI_PAUSED_KEY]: "1" }, keepTimestamp: true });
        await store.addEvent(c.id, "note", "Sie haben in der WhatsApp-App geantwortet – die KI hält sich in diesem Chat zurück, bis Sie sie wieder einschalten.");
      }
    }
  }
  await saveConnection({
    companyId: conn.companyId,
    provider: "whatsapp",
    metadata: { ...conn.metadata, knownContacts: [...known].slice(-MAX_KNOWN), seen: [...seen, ...echoes.map((e) => e.id)].slice(-200) },
  });
}

async function reply(conn: Connection, phoneNumberId: string, to: string, text: string) {
  await sendWhatsAppText(conn.accessToken!, phoneNumberId, to, text).catch((err) => console.error("[whatsapp] Antwort nicht gesendet:", err instanceof Error ? err.message : "unbekannt"));
}

async function handleMessage(store: Store, conn: Connection, phoneNumberId: string, m: WhatsAppInbound): Promise<void> {
  const phone = `+${m.from.replace(/\D/g, "")}`;
  const texts = (await store.getCompany()).businessProfile?.texts;
  if (m.unsupported) {
    await reply(conn, phoneNumberId, phone, customerText(texts, m.unsupported === "audio" ? "whatsapp.audio" : "whatsapp.unsupported"));
    return;
  }

  const route = async (text: string) => {
    try {
      return (await routeInbound(store, { companyId: conn.companyId, channel: "whatsapp", text: text.slice(0, 1500), sender: { phone, name: m.name || undefined } })).turn;
    } catch (err) {
      if (err instanceof CaseLimitReachedError) {
        await reply(conn, phoneNumberId, phone, customerText(texts, "other.caseLimit"));
        return null;
      }
      throw err;
    }
  };

  // Sprachnachricht: abtippen und wie eine Textnachricht behandeln; klappt das nicht, um eine kurze Textnachricht bitten.
  if (m.audio) {
    const file = await downloadMedia(conn.accessToken!, m.audio.id).catch(() => null);
    const text = file ? await transcribeAudio(file.bytes, file.mime || m.audio.mime) : null;
    if (!text) {
      await reply(conn, phoneNumberId, phone, customerText(texts, "whatsapp.audio"));
      return;
    }
    const turn = await route(text);
    if (turn?.sessionId) await store.addEvent(turn.sessionId, "note", `Sprachnachricht abgetippt: „${text.slice(0, 300)}“`);
    return;
  }

  if (!m.media) {
    if (m.text.trim()) await route(m.text);
    return;
  }

  // Foto/PDF: zum bestehenden Fall des Kunden – sonst mit der Bildunterschrift (oder einem Hinweis) einen Fall anlegen.
  let caseId = findCaseByIdentity(await store.listCases(), { phone })?.id ?? null;
  if (!caseId || m.text.trim()) {
    const turn = await route(m.text.trim() || "Ich schicke Ihnen eine Datei zu meiner Anfrage.");
    caseId = turn?.sessionId ?? caseId;
  }
  if (!caseId) return;
  const file = await downloadMedia(conn.accessToken!, m.media.id).catch(() => null);
  const mime = file ? sniffMime(file.bytes) : null;
  if (!file || !mime) {
    await store.addEvent(caseId, "note", `Kunde hat per WhatsApp eine Datei geschickt (${m.media.filename}), die nicht übernommen werden konnte – bitte in WhatsApp nachsehen.`);
    await reply(conn, phoneNumberId, phone, customerText(texts, "whatsapp.fileError"));
    return;
  }
  await receiveCaseDocument(store, caseId, file.bytes, m.media.filename);
  await store.addMessage(caseId, "user", `[Datei: ${m.media.filename}]`, { channel: "whatsapp", delivery: "delivered" });
  const refreshed = await refreshCase(store, caseId, { hint: "waiting" });
  const text = refreshed.becamePrepared ? "Vielen Dank, Ihre Datei ist angekommen – damit haben wir alles. Wir melden uns bei Ihnen." : "Vielen Dank, Ihre Datei ist angekommen.";
  await reply(conn, phoneNumberId, phone, text);
  await store.addMessage(caseId, "assistant", text, { channel: "whatsapp", delivery: "delivered" });
}
