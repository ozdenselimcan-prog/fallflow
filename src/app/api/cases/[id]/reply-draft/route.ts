import { apiError, json, withSession } from "@/lib/api";
import { knowledgeOf } from "@/lib/ai/knowledge";
import { draftReply } from "@/lib/ai/reply-draft";
import { attentionOf } from "@/lib/cases/attention";
import { frameEmail } from "@/lib/intake/case-ops";
import { caseIdSchema } from "@/lib/validation";

/**
 * KI-Entwurf für eine persönliche Antwort im Fall (nichts wird gesendet): aus Verlauf, Betriebsprofil und „Wissen & Preise“.
 * E-Mail mit Anrede und Gruß (Texte des Betriebs), WhatsApp ohne. Unbekanntes steht als [bitte ergänzen: …] im Text.
 */
export const POST = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/reply-draft">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const [c, company, messages] = await Promise.all([store.getCase(id), store.getCompany(), store.listMessages(id)]);
    if (!c) return apiError("Nicht gefunden", 404);
    const channel = c.source === "whatsapp" ? ("whatsapp" as const) : ("email" as const);
    const p = company.businessProfile;
    const draft = await draftReply({
      companyName: company.name,
      industry: p.industry,
      description: p.description,
      services: company.services.filter((s) => s !== "Sonstiges"),
      knowledge: knowledgeOf(p),
      customerName: c.fields.name ?? c.customerName,
      channel,
      messages: messages.filter((m) => m.delivery !== "internal"),
      reason: attentionOf(c.fields),
    });
    if (!draft) return apiError("Der Entwurf konnte gerade nicht erstellt werden. Bitte gleich noch einmal versuchen.", 503);
    return json({ text: channel === "email" ? await frameEmail(store, draft, c.fields.name) : draft });
  },
  { permission: "cases:write", limit: 30 },
);
