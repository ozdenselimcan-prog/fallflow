import type { MessageChannel } from "@/lib/data/types";
import { IntegrationNotReadyError } from "./email";
import { gmailProvider } from "./gmail";
import { microsoftProvider } from "./microsoft";
import { whatsappProvider } from "./whatsapp";

export interface DeliveryResult {
  delivered: boolean;
  /** Warum nichts versendet wurde (für die Anzeige im Dashboard) */
  reason: string;
}

/**
 * Versand an Kunden über die Kanal-Adapter. Es wird nie ein Erfolg vorgetäuscht:
 * solange ein Kanal nicht verbunden bzw. nicht implementiert ist, ist delivered = false.
 * Der Website-Chat gilt als zugestellt, weil die Antwort direkt im offenen Chatfenster erscheint.
 */
export async function deliverToCustomer(input: {
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
      const missing = whatsappProvider.missingConfig();
      if (missing.length) return { delivered: false, reason: "WhatsApp ist nicht verbunden (Demo-Modus)." };
      if (!input.phone) return { delivered: false, reason: "Keine Telefonnummer vorhanden." };
      await whatsappProvider.sendMessage(input.phone, input.text);
      return { delivered: true, reason: "" };
    }
    const provider = [gmailProvider, microsoftProvider].find((p) => p.missingConfig().length === 0);
    if (!provider) return { delivered: false, reason: "Kein E-Mail-Postfach verbunden (Demo-Modus)." };
    if (!input.email) return { delivered: false, reason: "Keine E-Mail-Adresse vorhanden." };
    await provider.sendReply(input.email, input.subject ?? "Ihre Anfrage zur Energieberatung", input.text);
    return { delivered: true, reason: "" };
  } catch (err) {
    if (err instanceof IntegrationNotReadyError) return { delivered: false, reason: err.message };
    console.error("[outbound] Versand fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return { delivered: false, reason: "Versand fehlgeschlagen." };
  }
}
