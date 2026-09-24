import type { Store } from "@/lib/data/store";
import type { FollowUp, MessageChannel } from "@/lib/data/types";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { buildChecklist } from "./checklist";

/** Kanal für Nachfass-Nachrichten: dort, wo der Kunde sich gemeldet hat – sonst E-Mail. */
function followUpChannel(source: string, hasEmail: boolean): Extract<MessageChannel, "email" | "whatsapp"> {
  if (source === "whatsapp") return "whatsapp";
  if (source === "email" || hasEmail) return "email";
  return "whatsapp";
}

export interface DispatchSummary {
  due: number;
  sent: number;
  /** fällig, aber nicht versendbar (Kanal nicht verbunden) → Team muss selbst nachfassen */
  manual: number;
  cancelled: number;
}

/**
 * Verarbeitet fällige Follow-ups. Versendet wird nur über einen wirklich verbundenen Kanal; sonst wird das
 * Follow-up auf „manuell“ gesetzt und im Dashboard als fällig angezeigt – es wird nie ein Versand vorgetäuscht.
 */
export async function dispatchDueFollowUps(store: Store, now = new Date()): Promise<DispatchSummary> {
  const summary: DispatchSummary = { due: 0, sent: 0, manual: 0, cancelled: 0 };
  const due = (await store.listFollowUps()).filter((f) => f.status === "planned" && Date.parse(f.scheduledFor) <= now.getTime());
  if (due.length === 0) return summary;
  const [questions, documents] = await Promise.all([store.listQuestions(), store.listDocuments()]);

  for (const f of due) {
    summary.due++;
    const c = await store.getCase(f.caseId);
    const stillNeeded = c && c.status !== "CONVERTED" && buildChecklist({ questions, fields: c.fields, documents: documents.filter((d) => d.caseId === c.id) }).missing.length > 0;
    if (!c || !stillNeeded) {
      await store.saveFollowUp({ ...f, status: "cancelled", note: "Nicht mehr nötig." });
      summary.cancelled++;
      continue;
    }
    const channel = followUpChannel(c.source, Boolean(c.fields.email));
    const result = await deliverToCustomer({ channel, email: c.fields.email, phone: c.fields.phone, text: f.message, subject: "Ihre Anfrage zur Energieberatung" });
    if (result.delivered) {
      await store.saveFollowUp({ ...f, status: "sent", sentAt: now.toISOString(), note: "" });
      await store.addMessage(c.id, "assistant", f.message, { channel, delivery: "delivered" });
      await store.addEvent(c.id, "followup", "Follow-up versendet");
      summary.sent++;
    } else {
      await store.saveFollowUp({ ...f, status: "manual", note: result.reason });
      await store.addEvent(c.id, "followup", `Follow-up fällig – bitte manuell nachfassen (${result.reason})`);
      summary.manual++;
    }
  }
  return summary;
}

/** Team hat das Follow-up selbst gesendet (z. B. aus dem eigenen Mailprogramm). */
export async function markFollowUpSentManually(store: Store, f: FollowUp) {
  const c = await store.getCase(f.caseId);
  await store.saveFollowUp({ ...f, status: "sent", sentAt: new Date().toISOString(), note: "Vom Team manuell gesendet." });
  if (c) {
    await store.addMessage(c.id, "staff", f.message, { channel: c.fields.email ? "email" : "whatsapp", delivery: "delivered" });
    await store.addEvent(c.id, "followup", "Follow-up manuell vom Team gesendet");
  }
}
