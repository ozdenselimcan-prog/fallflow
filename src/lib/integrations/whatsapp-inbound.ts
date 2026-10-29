import { CASE_LIMIT_REACHED_TEXT } from "@/lib/billing/limits";
import { getPublicStore } from "@/lib/data";
import type { Store } from "@/lib/data/store";
import { sniffMime } from "@/lib/documents/storage";
import { receiveCaseDocument, refreshCase } from "@/lib/intake/case-ops";
import { CaseLimitReachedError } from "@/lib/intake/engine";
import { findCaseByIdentity } from "@/lib/intake/identity";
import { routeInbound } from "@/lib/intake/router";
import { findWhatsAppConnection, saveConnection, type Connection } from "./connections-store";
import { downloadMedia, markRead, parseWebhook, sendWhatsAppText, type WhatsAppInbound } from "./whatsapp";

/**
 * Verarbeitet einen WhatsApp-Webhook: jede Nachricht dem Betrieb (über die Telefonnummer-ID) und dem Kunden-Fall
 * (über die Handynummer) zuordnen und wie im Website-Chat beantworten – eine Frage nach der anderen. Fotos und PDFs
 * landen in der Fallakte. Meta schickt Webhooks bei Zeitüberschreitung erneut – bereits verarbeitete Nachrichten
 * (ID) werden übersprungen.
 */
export async function handleWhatsAppWebhook(body: unknown): Promise<void> {
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
    for (const m of fresh) {
      await markRead(conn.accessToken, group.phoneNumberId, m.id);
      await handleMessage(store, conn, group.phoneNumberId, m).catch((err) => console.error("[whatsapp] Nachricht nicht verarbeitet:", err instanceof Error ? err.message : "unbekannt"));
    }
  }
}

async function reply(conn: Connection, phoneNumberId: string, to: string, text: string) {
  await sendWhatsAppText(conn.accessToken!, phoneNumberId, to, text).catch((err) => console.error("[whatsapp] Antwort nicht gesendet:", err instanceof Error ? err.message : "unbekannt"));
}

async function handleMessage(store: Store, conn: Connection, phoneNumberId: string, m: WhatsAppInbound): Promise<void> {
  const phone = `+${m.from.replace(/\D/g, "")}`;
  if (m.unsupported) {
    const what = m.unsupported === "audio" ? "Sprachnachrichten kann ich leider nicht anhören" : "Diese Art Nachricht kann ich leider nicht lesen";
    await reply(conn, phoneNumberId, phone, `${what} – schreiben Sie mir bitte kurz, worum es geht. Fotos und PDFs können Sie gern schicken.`);
    return;
  }

  const route = async (text: string) => {
    try {
      return (await routeInbound(store, { companyId: conn.companyId, channel: "whatsapp", text: text.slice(0, 1500), sender: { phone, name: m.name || undefined } })).turn;
    } catch (err) {
      if (err instanceof CaseLimitReachedError) {
        await reply(conn, phoneNumberId, phone, CASE_LIMIT_REACHED_TEXT);
        return null;
      }
      throw err;
    }
  };

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
    await reply(conn, phoneNumberId, phone, "Vielen Dank! Diese Datei konnte ich leider nicht öffnen – bitte schicken Sie sie als Foto oder PDF.");
    return;
  }
  await receiveCaseDocument(store, caseId, file.bytes, m.media.filename);
  await store.addMessage(caseId, "user", `[Datei: ${m.media.filename}]`, { channel: "whatsapp", delivery: "delivered" });
  const refreshed = await refreshCase(store, caseId, { hint: "waiting" });
  const text = refreshed.becamePrepared ? "Vielen Dank, Ihre Datei ist angekommen – damit haben wir alles. Wir melden uns bei Ihnen." : "Vielen Dank, Ihre Datei ist angekommen.";
  await reply(conn, phoneNumberId, phone, text);
  await store.addMessage(caseId, "assistant", text, { channel: "whatsapp", delivery: "delivered" });
}
