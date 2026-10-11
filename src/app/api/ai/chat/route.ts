import { json, parseBody, withSession } from "@/lib/api";
import { answerWebsiteChat, chatTurnOf } from "@/lib/intake/website-chat";
import { aiChatSchema } from "@/lib/validation";

/** Vorschau des Website-Chats im Dashboard – gleiche Antworten wie im Widget, es wird nichts gespeichert. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, aiChatSchema);
    if (!body.ok) return body.res;
    return json(chatTurnOf(await answerWebsiteChat(store, body.data.text, body.data.history ?? [])));
  },
  { limit: 30 },
);
