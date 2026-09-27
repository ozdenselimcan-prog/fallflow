import type { MessageChannel } from "@/lib/data/types";
import { getValidTokens } from "./tokens";
import { getConnection } from "./connections-store";
import { IntegrationNotReadyError } from "./email";
import { gmailProvider } from "./gmail";
import { microsoftProvider } from "./microsoft";
import { sendWhatsAppMessage } from "./whatsapp";

export interface DeliveryResult {
  delivered: boolean;
  /** Warum nichts versendet wurde (für die Anzeige im Dashboard) */
  reason: string;
}

const EMAIL_PROVIDERS = [gmailProvider, microsoftProvider];

/**
 * Versand an Kunden über die vom jeweiligen Büro verbundenen Kanäle (siehe connections-store.ts).
 * Es wird nie ein Erfolg vorgetäuscht: solange dieses Büro keinen passenden Kanal verbunden hat,
 * ist delivered = false. Der Website-Chat gilt als zugestellt, weil die Antwort direkt im offenen
 * Chatfenster erscheint.
 */
export async function deliverToCustomer(input: {
  companyId: string;
  channel: MessageChannel;
  email?: string;
  phone?: string;
  subject?: string;
  text: string;
  simulated?: boolean;
}): Promise<DeliveryResult> {
  if (input.channel === "website") return { delivered: true, reason: "" };
  if (input.simulated) return { delivered: false, reason: "Simulation – es wurde nichts versendet." };
  if (input.channel === "phone") return { delivered: false, reason: "Telefonnotiz – kein Versand." };

  try {
    if (input.channel === "whatsapp") {
      const connection = await getConnection(input.companyId, "whatsapp");
      if (!connection || connection.status !== "connected" || !connection.accessToken) return { delivered: false, reason: "WhatsApp ist für dieses Büro nicht verbunden." };
      if (!input.phone) return { delivered: false, reason: "Keine Telefonnummer vorhanden." };
      const phoneNumberId = String(connection.metadata.phoneNumberId ?? "");
      if (!phoneNumberId) return { delivered: false, reason: "WhatsApp-Verbindung ist unvollständig konfiguriert." };
      await sendWhatsAppMessage({ phoneNumberId, accessToken: connection.accessToken, to: input.phone, text: input.text });
      return { delivered: true, reason: "" };
    }

    for (const provider of EMAIL_PROVIDERS) {
      const found = await getValidTokens(provider, input.companyId);
      if (!found) continue;
      if (!input.email) return { delivered: false, reason: "Keine E-Mail-Adresse vorhanden." };
      await provider.sendReply(found.tokens, input.email, input.subject ?? "Ihre Anfrage zur Energieberatung", input.text);
      return { delivered: true, reason: "" };
    }
    return { delivered: false, reason: "Für dieses Büro ist kein E-Mail-Postfach verbunden." };
  } catch (err) {
    if (err instanceof IntegrationNotReadyError) return { delivered: false, reason: err.message };
    console.error("[outbound] Versand fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return { delivered: false, reason: "Versand fehlgeschlagen." };
  }
}
