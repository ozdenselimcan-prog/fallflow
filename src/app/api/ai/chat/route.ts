import { json, parseBody, withSession } from "@/lib/api";
import { extractFields } from "@/lib/ai/case-extractor";
import { applyTurn } from "@/lib/ai/conversation";
import { aiChatSchema } from "@/lib/validation";

/**
 * Zustandsloser Gesprächszug für die Assistenten-Vorschau im Dashboard.
 * Der Client hält die bisherigen Felder; es wird nichts gespeichert.
 */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, aiChatSchema);
    if (!body.ok) return body.res;
    const [questions, settings] = await Promise.all([store.listQuestions(), store.getAssistant()]);
    const extracted = body.data.first ? (await extractFields(body.data.text)).fields : undefined;
    return json(applyTurn({ questions, settings, fields: body.data.fields, text: body.data.text, first: body.data.first, extracted }));
  },
  { limit: 30 },
);
