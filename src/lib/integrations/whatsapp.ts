import { IntegrationNotReadyError } from "./email";

export interface InboundWhatsAppMessage {
  from: string;
  text: string;
  externalId: string;
}

/** Adapter-Schnittstelle für die WhatsApp Business Cloud API. Noch keine produktive Anbindung. */
export interface WhatsAppProvider {
  missingConfig(): string[];
  /** Webhook-Verifizierung (GET): gibt die Challenge zurück oder null bei falschem Token. */
  verifyWebhook(mode: string | null, token: string | null, challenge: string | null): string | null;
  parseWebhook(payload: unknown): InboundWhatsAppMessage[];
  sendMessage(to: string, text: string): Promise<void>;
}

export const whatsappProvider: WhatsAppProvider = {
  missingConfig: () => ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN"].filter((k) => !process.env[k]),
  verifyWebhook(mode, token, challenge) {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    return mode === "subscribe" && expected && token === expected ? challenge : null;
  },
  parseWebhook(payload) {
    const out: InboundWhatsAppMessage[] = [];
    const entries = (payload as { entry?: { changes?: { value?: { messages?: { from?: string; id?: string; text?: { body?: string } }[] } }[] }[] })?.entry ?? [];
    for (const e of entries)
      for (const c of e.changes ?? [])
        for (const m of c.value?.messages ?? []) if (m.from && m.id && m.text?.body) out.push({ from: m.from, externalId: m.id, text: m.text.body });
    return out;
  },
  async sendMessage() {
    // TODO (benötigt WhatsApp-Business-Zugang): POST https://graph.facebook.com/v20.0/{PHONE_NUMBER_ID}/messages
    throw new IntegrationNotReadyError("WhatsApp-Versand ist noch nicht implementiert.");
  },
};
