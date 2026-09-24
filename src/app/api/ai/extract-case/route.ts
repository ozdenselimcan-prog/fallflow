import { json, parseBody, withSession } from "@/lib/api";
import { extractFields, fieldsToExtraction } from "@/lib/ai/case-extractor";
import { extractSchema } from "@/lib/validation";

/** Extrahiert strukturierte Falldaten aus Freitext (z. B. eingehende E-Mail) im spezifizierten JSON-Format. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, extractSchema);
    if (!body.ok) return body.res;
    const [result, questions] = await Promise.all([extractFields(body.data.text), store.listQuestions()]);
    const required = questions.filter((q) => q.active && q.required).map((q) => q.key);
    return json({ extraction: fieldsToExtraction(result.fields, required), source: result.source, degraded: result.degraded });
  },
  { limit: 30 },
);
