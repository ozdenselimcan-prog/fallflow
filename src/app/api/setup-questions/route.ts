import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { interpretSetupAnswer } from "@/lib/ai/setup-answer";
import { SETUP_QUESTIONS, setupQuestion, type SetupAnswer } from "@/lib/config/setup-questions";

/** Einrichtungs-Fragebogen: GET Fragen mit aktueller Auswahl, POST eine Antwort übernehmen (stellt sofort alles ein). */
export const GET = withSession(async (_req, { store }) => {
  const [company, assistant] = await Promise.all([store.getCompany(), store.getAssistant()]);
  const saved = company.businessProfile.setupAnswers ?? {};
  const state = { assistant, profile: company.businessProfile };
  return json({
    questions: SETUP_QUESTIONS.map((q) => ({
      id: q.id,
      group: q.group,
      question: q.question,
      hint: q.hint ?? "",
      otherPlaceholder: q.otherPlaceholder,
      extra: q.extra ?? null,
      answer: saved[q.id] ?? { choice: q.current(state) },
    })),
  });
});

const schema = z.object({
  id: z.string().max(40),
  choice: z.enum(["yes", "no", "other"]),
  text: z.string().trim().max(500).optional(),
  extra: z.string().trim().max(500).optional(),
});

export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const q = setupQuestion(body.data.id);
    if (!q) return apiError("Unbekannte Frage", 400);
    const [company, assistant] = await Promise.all([store.getCompany(), store.getAssistant()]);
    const profile = company.businessProfile;
    const { choice, text = "", extra = "" } = body.data;
    if (choice === "other" && !text) return apiError("Bitte Ihre Antwort eintippen.", 400);
    const { decision, value } = choice === "other" ? await interpretSetupAnswer(q, text, q.current({ assistant, profile })) : { decision: choice, value: extra };
    const patch = q.apply(decision, value, { assistant, profile });

    if (patch.assistant) await store.saveAssistant({ ...assistant, ...patch.assistant });
    const texts = { ...(profile.texts ?? {}) };
    for (const [k, v] of Object.entries(patch.texts ?? {})) {
      if (v) texts[k] = v;
      else delete texts[k];
    }
    const answer: SetupAnswer = { choice, ...(text ? { text } : {}), ...(extra ? { extra } : {}) };
    // „Wissen & Preise“: häufige Frage setzen/entfernen, Preise ergänzen (gleiche Bezeichnung wird ersetzt).
    let knowledge = profile.knowledge ?? { prices: [], faqs: [] };
    if (patch.faq) {
      const faqs = knowledge.faqs.filter((f) => f.q !== patch.faq!.q);
      knowledge = { ...knowledge, faqs: patch.faq.a ? [...faqs, { q: patch.faq.q, a: patch.faq.a }] : faqs };
    }
    if (patch.prices?.length) {
      const names = new Set(patch.prices.map((p) => p.item.toLowerCase()));
      knowledge = { ...knowledge, prices: [...knowledge.prices.filter((p) => !names.has(p.item.toLowerCase())), ...patch.prices] };
    }
    // Fotos bei allen Leistungen anfordern bzw. nirgends mehr.
    let documents = profile.documents;
    let documentsByService = profile.documentsByService;
    if (patch.photos !== undefined) {
      const isPhoto = (d: string) => /foto|bild/i.test(d);
      const photo = documents.find(isPhoto) ?? "Fotos vom Auftrag";
      documents = patch.photos ? [...new Set([...documents, photo])] : documents.filter((d) => !isPhoto(d));
      documentsByService = Object.fromEntries(
        Object.entries(documentsByService ?? {}).map(([svc, docs]) => [svc, patch.photos ? [...new Set([...docs, photo])] : docs.filter((d) => !isPhoto(d))]),
      );
    }
    await store.updateCompany({
      businessProfile: {
        ...profile,
        texts,
        knowledge,
        documents,
        documentsByService,
        ...(patch.quoteVatRate !== undefined ? { quoteDefaults: { ...(profile.quoteDefaults ?? {}), vatRate: patch.quoteVatRate } } : {}),
        automation: { ...(profile.automation ?? {}), ...(patch.automation ?? {}) },
        ...(patch.needsAddress !== undefined ? { needsAddress: patch.needsAddress } : {}),
        setupAnswers: { ...(profile.setupAnswers ?? {}), [q.id]: answer },
      },
    });
    // Vor Ort ja/nein: Adressfragen ein- bzw. ausschalten (wie beim Speichern des Betriebsprofils).
    if (patch.needsAddress !== undefined) {
      for (const qq of await store.listQuestions()) {
        if (qq.key === "street" || qq.key === "postalCode") await store.saveQuestion({ ...qq, required: patch.needsAddress, active: patch.needsAddress });
      }
    }
    return json({ ok: true, decision, applied: patch });
  },
  { permission: "assistant:manage", limit: 120 },
);
