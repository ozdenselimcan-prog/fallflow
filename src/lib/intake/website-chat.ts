import { answerCustomerQuestion, contactLine, type ChatHistoryEntry, type QuestionContext } from "@/lib/ai/answer-question";
import { WEEKDAY_LABELS } from "@/lib/cases/fields";
import type { Store } from "@/lib/data/store";

/**
 * Website-Chat = reiner Frage-Antwort-Assistent: beantwortet Fragen zum Büro und zur Energieberatung.
 * Es wird kein Fall angelegt und nichts gespeichert. Anfragen und Termine laufen per E-Mail oder Telefon.
 */
export async function chatContext(store: Store): Promise<QuestionContext> {
  const [company, settings, serviceMessages, channels] = await Promise.all([store.getCompany(), store.getAssistant(), store.listServiceMessages(), store.listChannels()]);
  const mailbox = channels.find((c) => c.kind === "gmail" && c.status === "connected")?.account ?? "";
  return {
    companyName: company.name,
    assistantName: settings.name,
    tone: settings.tone,
    services: company.services,
    address: company.address,
    phone: company.phone,
    email: mailbox.includes("@") ? mailbox : "",
    website: company.website,
    serviceNotes: serviceMessages.map((m) => ({ service: m.service, text: m.body })),
    availability: settings.workingDays.length ? `${settings.workingDays.map((d) => WEEKDAY_LABELS[d]).join(", ")}, ${settings.slotStart}–${settings.slotEnd} Uhr` : "",
  };
}

/** Feste Antwort, wenn keine KI verfügbar ist oder sie nicht antwortet. */
export function fallbackChatReply(ctx: QuestionContext): string {
  const services = ctx.services.length ? ` Wir bieten unter anderem ${ctx.services.slice(0, 6).join(", ")} an.` : "";
  return `Vielen Dank für Ihre Nachricht!${services} Für eine Anfrage, einen Termin oder individuelle Fragen erreichen Sie uns ${contactLine(ctx)}.`;
}

export async function answerWebsiteChat(store: Store, text: string, history: ChatHistoryEntry[] = []): Promise<string> {
  const ctx = await chatContext(store);
  return (await answerCustomerQuestion(text, ctx, history)) ?? fallbackChatReply(ctx);
}

/** Antwortformat, das die Chat-Oberfläche (ChatClient) erwartet – ohne Sitzung, Fall oder Upload. */
export function chatTurnOf(reply: string) {
  return { sessionId: null, replies: [reply], quickReplies: [], done: false, completeness: 0, upload: null };
}
