import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { readFile } from "@/lib/documents/storage";
import { emailSubjectFor } from "@/lib/intake/case-ops";
import type { InboundAttachment } from "@/lib/integrations/email";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { caseIdSchema } from "@/lib/validation";

const schema = z.object({ messageId: z.string().min(1).max(100) });

/**
 * „Erneut senden“: Eine E-Mail an den Kunden, die nicht versendet werden konnte (z. B. Tageslimit des Postfachs erreicht,
 * Postfach kurz gesperrt), noch einmal verschicken. Sagt die Nachricht „im Anhang“, gehen die Vorlagen des Falls wieder mit.
 */
export const POST = withSession(
  async (req, { store }, ctx: RouteContext<"/api/cases/[id]/resend">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);
    const message = (await store.listMessages(id)).find((m) => m.id === body.data.messageId);
    if (!message || message.channel !== "email" || message.delivery !== "not_sent" || message.role === "user") return apiError("Diese Nachricht kann nicht erneut gesendet werden.", 400);
    if (!c.fields.email) return apiError("Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.", 400);

    const attachments: InboundAttachment[] = [];
    if (/anhang/i.test(message.content)) {
      const [templateDocs, templates] = await Promise.all([store.listTemplateDocuments(id), store.listDocumentTemplates()]);
      for (const td of templateDocs) {
        const tpl = templates.find((t) => t.id === td.templateId);
        const file = tpl ? await readFile(tpl.storagePath) : null;
        if (tpl && file) attachments.push({ filename: tpl.fileName, mime: "application/pdf", bytes: file.bytes });
      }
    }
    const result = await deliverToCustomer({ companyId: c.companyId, channel: "email", email: c.fields.email, text: message.content, attachments, subject: await emailSubjectFor(store, c.fields.service) });
    if (result.delivered) {
      await store.setMessageDelivery(message.id, "delivered");
      await store.addEvent(id, "note", "Nicht versendete Nachricht erneut gesendet");
    }
    return json({ delivered: result.delivered, reason: result.reason });
  },
  { permission: "cases:write" },
);
