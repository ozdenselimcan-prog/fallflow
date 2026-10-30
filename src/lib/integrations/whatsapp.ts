import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp Business (Meta Cloud API): Nachrichten empfangen (Webhook), Antworten senden, Fotos/PDFs laden.
 * Jeder Betrieb verbindet seine eigene WhatsApp-Nummer (Telefonnummer-ID + Zugangstoken, verschlüsselt in
 * `connections`). Der Webhook ist für alle gleich; die Telefonnummer-ID in der Nachricht ordnet sie dem Betrieb zu.
 */

const GRAPH = "https://graph.facebook.com/v25.0";
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

/** Prüft X-Hub-Signature-256 (HMAC-SHA256 des Roh-Bodys mit dem App-Geheimnis). */
export function validMetaSignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface WhatsAppInbound {
  id: string;
  from: string;
  name: string;
  /** Text bzw. Bildunterschrift */
  text: string;
  media: { id: string; mime: string; filename: string } | null;
  /** Nicht unterstützte Art (Sprachnachricht, Standort, Sticker …) */
  unsupported: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Liest die Nachrichten aus einem Webhook-Aufruf, gruppiert nach Telefonnummer-ID des Betriebs. */
export function parseWebhook(body: any): { phoneNumberId: string; messages: WhatsAppInbound[] }[] {
  const out: { phoneNumberId: string; messages: WhatsAppInbound[] }[] = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const phoneNumberId = String(value?.metadata?.phone_number_id ?? "");
      if (!phoneNumberId || !Array.isArray(value?.messages)) continue;
      const names = new Map<string, string>((value.contacts ?? []).map((c: any) => [String(c.wa_id), String(c.profile?.name ?? "")]));
      const messages: WhatsAppInbound[] = [];
      for (const m of value.messages) {
        const from = String(m.from ?? "");
        const base = { id: String(m.id ?? ""), from, name: names.get(from) ?? "", text: "", media: null, unsupported: null };
        if (m.type === "text") messages.push({ ...base, text: String(m.text?.body ?? "") });
        else if (m.type === "button") messages.push({ ...base, text: String(m.button?.text ?? "") });
        else if (m.type === "interactive") messages.push({ ...base, text: String(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "") });
        else if (m.type === "image" || m.type === "document") {
          const media = m[m.type];
          messages.push({
            ...base,
            text: String(media?.caption ?? ""),
            media: { id: String(media?.id ?? ""), mime: String(media?.mime_type ?? ""), filename: String(media?.filename ?? (m.type === "image" ? "foto.jpg" : "dokument.pdf")) },
          });
        } else messages.push({ ...base, unsupported: String(m.type ?? "unbekannt") });
      }
      out.push({ phoneNumberId, messages });
    }
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function graph<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`WhatsApp antwortete mit HTTP ${res.status}${detail ? ` (${detail.slice(0, 160)})` : ""}`);
  }
  return (await res.json()) as T;
}

/** Textnachricht senden (innerhalb von 24 h nach der letzten Kundennachricht ohne Vorlage erlaubt). */
export async function sendWhatsAppText(token: string, phoneNumberId: string, to: string, text: string): Promise<void> {
  await graph(token, `/${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/\D/g, ""), type: "text", text: { preview_url: true, body: text.slice(0, 4000) } }),
  });
}

/** Nachricht als gelesen markieren (blaue Haken) – reine Höflichkeit, Fehler egal. */
export async function markRead(token: string, phoneNumberId: string, messageId: string): Promise<void> {
  await graph(token, `/${phoneNumberId}/messages`, { method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }) }).catch(() => {});
}

/** Foto/PDF eines Kunden laden (erst die Download-Adresse, dann die Datei – beides mit dem Token). */
export async function downloadMedia(token: string, mediaId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const info = await graph<{ url?: string; mime_type?: string; file_size?: number }>(token, `/${mediaId}`);
  if (!info.url || (info.file_size ?? 0) > MAX_MEDIA_BYTES) return null;
  const res = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.length <= MAX_MEDIA_BYTES ? { bytes, mime: info.mime_type ?? "" } : null;
}

/** Zugangsdaten prüfen: liefert die angezeigte Nummer und den geprüften Namen des Betriebs. */
export async function checkWhatsAppNumber(token: string, phoneNumberId: string): Promise<{ display: string; name: string }> {
  const r = await graph<{ display_phone_number?: string; verified_name?: string }>(token, `/${phoneNumberId}?fields=display_phone_number,verified_name`);
  return { display: r.display_phone_number ?? "", name: r.verified_name ?? "" };
}

/**
 * Meldet die App bei den WhatsApp-Konten an, auf die der Token Zugriff hat ("subscribed_apps") – erst danach schickt
 * Meta eingehende Nachrichten an unseren Webhook. Die Konto-IDs stehen in den Berechtigungen des Tokens (debug_token).
 * Gibt die angemeldeten Konto-IDs zurück; Fehler werden nur protokolliert.
 */
export async function subscribeApp(token: string): Promise<string[]> {
  try {
    const debug = await graph<{ data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>(token, `/debug_token?input_token=${encodeURIComponent(token)}`);
    const ids = [...new Set((debug.data?.granular_scopes ?? []).filter((s) => s.scope.startsWith("whatsapp_business")).flatMap((s) => s.target_ids ?? []))];
    const done: string[] = [];
    for (const id of ids) {
      await graph(token, `/${id}/subscribed_apps`, { method: "POST" })
        .then(() => done.push(id))
        .catch((err) => console.error("[whatsapp] subscribed_apps fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt"));
    }
    return done;
  } catch (err) {
    console.error("[whatsapp] Konten nicht ermittelbar:", err instanceof Error ? err.message : "unbekannt");
    return [];
  }
}

/**
 * Nummer nach der Anmeldung per Facebook selbst ermitteln, wenn Meta im Anmeldefenster keine (oder nur die Konto-ID)
 * übermittelt hat – z. B. wenn ein bestehendes WhatsApp-Konto gewählt wurde. Nimmt die erste Nummer des Kontos.
 */
export async function findSignupNumber(token: string, wabaId?: string): Promise<{ phoneNumberId: string; wabaId: string } | null> {
  let ids = wabaId ? [wabaId] : [];
  if (!ids.length) {
    const debug = await graph<{ data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }>(token, `/debug_token?input_token=${encodeURIComponent(token)}`);
    ids = [...new Set((debug.data?.granular_scopes ?? []).filter((s) => s.scope.startsWith("whatsapp_business")).flatMap((s) => s.target_ids ?? []))];
  }
  for (const id of ids) {
    const r = await graph<{ data?: { id: string }[] }>(token, `/${id}/phone_numbers?fields=id`).catch(() => ({ data: [] }));
    const first = r.data?.[0]?.id;
    if (first) return { phoneNumberId: first, wabaId: id };
  }
  return null;
}

/** Meta-App-Daten für die Anmeldung per Facebook (Embedded Signup) – ohne sie gibt es nur die manuelle Verbindung. */
export const embeddedSignupConfig = () =>
  process.env.META_APP_ID && process.env.WHATSAPP_CONFIG_ID && process.env.WHATSAPP_APP_SECRET ? { appId: process.env.META_APP_ID, configId: process.env.WHATSAPP_CONFIG_ID } : null;

/**
 * Code aus der Facebook-Anmeldung gegen einen dauerhaften Zugangstoken des Betriebs tauschen. Je nach App-Einstellung
 * verlangt Meta dabei dieselbe redirect_uri wie im Anmeldefenster (beim JS-SDK die aufrufende Seite) – daher erst ohne,
 * dann mit den möglichen Adressen. Ein abgelehnter Versuch verbraucht den Code nicht.
 */
export async function exchangeSignupCode(code: string, pageUrl?: string): Promise<string> {
  const candidates: (string | undefined)[] = [undefined, ""];
  if (pageUrl) {
    const u = new URL(pageUrl);
    candidates.push(`${u.origin}${u.pathname}`, `${u.origin}/`, u.origin);
  }
  let lastError = "";
  for (const redirect of [...new Set(candidates)]) {
    const q = new URLSearchParams({ client_id: process.env.META_APP_ID ?? "", client_secret: process.env.WHATSAPP_APP_SECRET ?? "", code });
    if (redirect !== undefined) q.set("redirect_uri", redirect);
    const res = await fetch(`${GRAPH}/oauth/access_token?${q}`, { signal: AbortSignal.timeout(10_000) });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
    if (res.ok && body.access_token) return body.access_token;
    lastError = body.error?.message ?? `HTTP ${res.status}`;
    if (!/redirect_uri/i.test(lastError)) break;
  }
  throw new Error(lastError);
}

/** Neue Nummer für die Cloud API freischalten (bei bereits registrierten Nummern meldet Meta einen harmlosen Fehler). */
export async function registerNumber(token: string, phoneNumberId: string, pin: string): Promise<void> {
  await graph(token, `/${phoneNumberId}/register`, { method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", pin }) }).catch((err) =>
    console.error("[whatsapp] Nummer nicht registriert (evtl. schon aktiv):", err instanceof Error ? err.message : "unbekannt"),
  );
}

/** App für Nachrichten eines bestimmten WhatsApp-Kontos anmelden. */
export async function subscribeWaba(token: string, wabaId: string): Promise<void> {
  await graph(token, `/${wabaId}/subscribed_apps`, { method: "POST" });
}
