import { inCustomerLanguage } from "@/lib/ai/language";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import type { DocumentKind } from "@/lib/data/types";
import { frameEmail, refreshCase, requestDocuments } from "@/lib/intake/case-ops";
import { buildChecklist } from "@/lib/intake/checklist";
import { customerText } from "@/lib/config/customer-texts";
import { documentList } from "@/lib/intake/messages";
import { deliverToCustomer } from "@/lib/integrations/outbound";
import { caseIdSchema, documentRequestSchema } from "@/lib/validation";

/**
 * „Dokument beim Kunden anfordern“: legt die Anforderung an, erzeugt den sicheren Upload-Link und bereitet die
 * Kundennachricht vor. Versendet wird nur über einen wirklich verbundenen Kanal – sonst bekommt das Team Text und
 * Link zurück und sendet selbst.
 */
export const POST = withSession(
  async (req, { store }, ctx: RouteContext<"/api/cases/[id]/documents">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const body = await parseBody(req, documentRequestSchema);
    if (!body.ok) return body.res;
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);

    const [questions, documents, company, serviceMessages] = await Promise.all([store.listQuestions(), store.listDocuments(id), store.getCompany(), store.listServiceMessages()]);
    const checklist = buildChecklist({
      questions,
      fields: c.fields,
      documents,
      foerderOverrides: { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan, profiled: Boolean(company.businessProfile?.industry) },
      serviceMessages,
    });
    // Nur klassische Dokumentarten – Vorlagen-Rückläufer ("template:…") laufen über die Büro-Vorlagen-Funktion, nicht hier.
    const kinds: DocumentKind[] = body.data.kinds ?? checklist.missing.filter((i) => i.kind === "document" && i.key.startsWith("doc:")).map((i) => i.key.replace("doc:", "") as DocumentKind);
    if (kinds.length === 0) return apiError("Es fehlen keine Dokumente.", 400);

    const { url } = await requestDocuments(store, c, kinds);
    const channel = c.source === "whatsapp" ? ("whatsapp" as const) : ("email" as const);
    const requestBody = customerText(company.businessProfile?.texts, "forms.uploadRequest", { liste: documentList(kinds), link: url });
    // E-Mail mit Anrede und Gruß, WhatsApp ohne – dort groß beginnen.
    const text = await inCustomerLanguage(c.fields, channel === "email" ? await frameEmail(store, requestBody, c.fields.name) : requestBody.charAt(0).toUpperCase() + requestBody.slice(1));
    const result = await deliverToCustomer({ companyId: c.companyId, channel, email: c.fields.email, phone: c.fields.phone, text, subject: "Unterlagen für Ihren Termin" });
    await store.addMessage(id, "staff", text, { channel, delivery: result.delivered ? "delivered" : "not_sent" });
    await store.addEvent(id, "document", result.delivered ? "Dokumentenanforderung an den Kunden gesendet" : "Dokumentenanforderung vorbereitet (nicht versendet)");
    await refreshCase(store, id, { hint: "waiting" });
    return json({ url, message: text, delivered: result.delivered, reason: result.reason, email: c.fields.email ?? "" }, 201);
  },
  { permission: "cases:write" },
);
