import type { MessageChannel } from "@/lib/data/types";
import { getValidTokens } from "./tokens";
import { IntegrationNotReadyError } from "./email";
import { gmailProvider } from "./gmail";

export interface DeliveryResult {
  delivered: boolean;
  /** Warum nichts versendet wurde (für die Anzeige im Dashboard) */
  reason: string;
}

const EMAIL_PROVIDERS = [gmailProvider];

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
