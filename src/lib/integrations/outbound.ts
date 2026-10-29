import { AsyncLocalStorage } from "node:async_hooks";
import { getConnection } from "./connections-store";
import { sendWhatsAppText } from "./whatsapp";
import type { MessageChannel } from "@/lib/data/types";
import { DEFAULT_EMAIL_SUBJECT } from "@/lib/cases/fields";
import { getValidTokens } from "./tokens";
import { friendlyMailError, IntegrationNotReadyError, type InboundAttachment, type ReplyTarget } from "./email";
import { gmailProvider } from "./gmail";
import { microsoftProvider } from "./microsoft";

export interface DeliveryResult {
  delivered: boolean;
  /** Warum nichts versendet wurde (für die Anzeige im Dashboard) */
  reason: string;
}

const EMAIL_PROVIDERS = [gmailProvider, microsoftProvider];

/** Test-Simulation (siehe /api/simulate/email): Alles, was innerhalb läuft, versendet garantiert keine echte Mail. */
const simulation = new AsyncLocalStorage<boolean>();
export const runSimulated = <T>(fn: () => Promise<T>): Promise<T> => simulation.run(true, fn);

/**
 * Während eine eingegangene Mail bearbeitet wird (siehe mail-sync.ts): Antworten an genau diesen Absender gehen als
 * echte Antwort auf seine Mail raus (gleicher Gesprächsverlauf) statt als neue Mail – das landet deutlich seltener im Spam.
 */
const replyContext = new AsyncLocalStorage<ReplyTarget & { from: string }>();
export const runAsReplyTo = <T>(target: ReplyTarget & { from: string }, fn: () => Promise<T>): Promise<T> => replyContext.run(target, fn);

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
  attachments?: InboundAttachment[];
}): Promise<DeliveryResult> {
  if (input.channel === "website") return { delivered: true, reason: "" };
  if (input.simulated || simulation.getStore()) return { delivered: false, reason: "Simulation – es wurde nichts versendet." };
  if (input.channel === "phone") return { delivered: false, reason: "Telefonnotiz – kein Versand." };
  if (input.channel === "whatsapp") {
    try {
      const conn = await getConnection(input.companyId, "whatsapp");
      const phoneNumberId = typeof conn?.metadata.phoneNumberId === "string" ? conn.metadata.phoneNumberId : "";
      if (!conn || conn.status !== "connected" || !conn.accessToken || !phoneNumberId) return { delivered: false, reason: "WhatsApp ist für dieses Büro nicht verbunden." };
      if (!input.phone) return { delivered: false, reason: "Keine WhatsApp-Nummer vorhanden." };
      await sendWhatsAppText(conn.accessToken, phoneNumberId, input.phone, input.text);
      return { delivered: true, reason: "" };
    } catch (err) {
      console.error("[outbound] WhatsApp-Versand fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
      return { delivered: false, reason: "WhatsApp-Versand fehlgeschlagen." };
    }
  }

  try {
    for (const provider of EMAIL_PROVIDERS) {
      const found = await getValidTokens(provider, input.companyId);
      if (!found) continue;
      if (!input.email) return { delivered: false, reason: "Keine E-Mail-Adresse vorhanden." };
      const target = replyContext.getStore();
      const reply = target && target.from === input.email.trim().toLowerCase() ? target : undefined;
      await provider.sendReply(found.tokens, input.email, input.subject || DEFAULT_EMAIL_SUBJECT, input.text, input.attachments, reply);
      return { delivered: true, reason: "" };
    }
    return { delivered: false, reason: "Für dieses Büro ist kein E-Mail-Postfach verbunden." };
  } catch (err) {
    if (err instanceof IntegrationNotReadyError) return { delivered: false, reason: err.message };
    const message = err instanceof Error ? err.message : "unbekannt";
    console.error("[outbound] Versand fehlgeschlagen:", message);
    const friendly = friendlyMailError(message);
    return { delivered: false, reason: friendly === message ? "Versand fehlgeschlagen." : friendly };
  }
}
