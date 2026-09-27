export interface InboundWhatsAppMessage {
  from: string;
  text: string;
  externalId: string;
  /** Telefonnummer-ID des Meta-Anschlusses, an den die Nachricht ging – identifiziert das Büro. */
  phoneNumberId: string;
}

/**
 * WhatsApp Business Cloud API. FallFlow hat eine Meta-App (WHATSAPP_APP_SECRET als Vercel-Variable,
 * für die Webhook-Signaturprüfung). Jedes Büro verbindet seinen EIGENEN WhatsApp-Business-Anschluss:
 * Zugriffstoken und Telefonnummer-ID werden pro Büro in `connections` gespeichert (siehe
 * connections-store.ts), nicht global. Der Verify-Token für den Webhook-Handshake ist ebenfalls global
 * (WHATSAPP_VERIFY_TOKEN) – er gehört zur einen Meta-App, an die alle Büros ihre Nummer anschließen.
 */

export const appConfigured = () => Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN);

/** Webhook-Verifizierung (GET): gibt die Challenge zurück oder null bei falschem Token. */
export function verifyWebhook(mode: string | null, token: string | null, challenge: string | null): string | null {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  return mode === "subscribe" && expected && token === expected ? challenge : null;
}

export function parseWebhook(payload: unknown): InboundWhatsAppMessage[] {
  const out: InboundWhatsAppMessage[] = [];
  const entries =
    (payload as { entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; messages?: { from?: string; id?: string; text?: { body?: string } }[] } }[] }[] })?.entry ?? [];
  for (const e of entries)
    for (const c of e.changes ?? []) {
      const phoneNumberId = c.value?.metadata?.phone_number_id ?? "";
      for (const m of c.value?.messages ?? []) if (m.from && m.id && m.text?.body && phoneNumberId) out.push({ from: m.from, externalId: m.id, text: m.text.body, phoneNumberId });
    }
  return out;
}

/** Sendet eine Nachricht über den Anschluss (Token + Phone-Number-ID) des jeweiligen Büros. */
export async function sendWhatsAppMessage(input: { phoneNumberId: string; accessToken: string; to: string; text: string }): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v20.0/${input.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: input.to.replace(/[^\d+]/g, ""), type: "text", text: { body: input.text } }),
  });
  if (!res.ok) throw new Error(`WhatsApp-Versand fehlgeschlagen (HTTP ${res.status}).`);
}
