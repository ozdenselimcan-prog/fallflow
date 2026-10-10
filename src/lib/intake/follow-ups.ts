import type { Store } from "@/lib/data/store";
import type { FollowUp } from "@/lib/data/types";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { buildChecklist } from "./checklist";
import { matchServiceMaterials } from "./case-ops";

export interface DispatchSummary {
  due: number;
  sent: number;
  /** fällig, aber nicht automatisch versendbar (Kanal nicht verbunden, oder nichts Neues zu verschicken) → Team muss selbst nachfassen */
  manual: number;
  cancelled: number;
}

/**
 * Verarbeitet fällige Follow-ups. Es wird NIE automatisch die generische Angaben-Checkliste per Mail
 * verschickt – stattdessen wird versucht, die vom Büro selbst verfasste Leistungs-Nachricht (+ PDF-Vorlage,
 * siehe matchServiceMaterials) nachzuliefern, falls das beim ersten Kontakt noch nicht möglich war (z. B.
 * weil die Leistung erst später erkannt wurde). Gibt es nichts Neues zu verschicken, gilt das Follow-up als
 * „manuell“ fällig – das Team meldet sich dann selbst, es wird nie ein Versand vorgetäuscht.
 */
export async function dispatchDueFollowUps(store: Store, now = new Date()): Promise<DispatchSummary> {
  const summary: DispatchSummary = { due: 0, sent: 0, manual: 0, cancelled: 0 };
  const due = (await store.listFollowUps()).filter((f) => f.status === "planned" && Date.parse(f.scheduledFor) <= now.getTime());
  if (due.length === 0) return summary;
  const [questions, documents, company, templates, serviceMessages] = await Promise.all([
    store.listQuestions(),
    store.listDocuments(),
    store.getCompany(),
    store.listDocumentTemplates(),
    store.listServiceMessages(),
  ]);
  const foerderOverrides = { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan };

  for (const f of due) {
    summary.due++;
    const c = await store.getCase(f.caseId);
    const stillNeeded =
      c &&
      c.status !== "CONVERTED" &&
      buildChecklist({ questions, fields: c.fields, documents: documents.filter((d) => d.caseId === c.id), foerderOverrides, serviceMessages, includeFields: c.source !== "email" }).missing.length > 0;
    if (!c || !stillNeeded) {
      await store.saveFollowUp({ ...f, status: "cancelled", note: "Nicht mehr nötig." });
      summary.cancelled++;
      continue;
    }
    const channel = "email" as const;
    const material = await matchServiceMaterials(store, c, templates, serviceMessages, channel);
    if (!material) {
      await store.saveFollowUp({ ...f, status: "manual", note: "Warte auf fehlende Angaben – bitte manuell nachfassen." });
      await store.addEvent(c.id, "followup", "Follow-up fällig – bitte manuell nachfassen");
      summary.manual++;
      continue;
    }
    const text = material.texts.join("\n\n");
    const result = await deliverToCustomer({ companyId: c.companyId, channel, email: c.fields.email, phone: c.fields.phone, text, attachments: material.attachments });
    if (result.delivered) {
      await store.saveFollowUp({ ...f, status: "sent", sentAt: now.toISOString(), note: "" });
      await store.addMessage(c.id, "assistant", text, { channel, delivery: "delivered" });
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
    await store.addMessage(c.id, "staff", f.message, { channel: "email", delivery: "delivered" });
    await store.addEvent(c.id, "followup", "Follow-up manuell vom Team gesendet");
  }
}
