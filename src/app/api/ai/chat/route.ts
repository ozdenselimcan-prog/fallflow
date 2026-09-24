import { json, parseBody, withSession } from "@/lib/api";
import { applyTurn } from "@/lib/ai/conversation";
import { extractForText } from "@/lib/intake/engine";
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
    const extracted = await extractForText(body.data.text);
    return json(applyTurn({ questions, settings, fields: body.data.fields, text: body.data.text, first: body.data.first, extracted }));
  },
  { limit: 30 },
);
