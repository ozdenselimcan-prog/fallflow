import { apiError, json, parseBody, publicRoute } from "@/lib/api";
import { getPublicStore } from "@/lib/data";
import { processChatMessage, SessionNotFoundError } from "@/lib/widget/service";
import { widgetMessageSchema } from "@/lib/validation";

/**
 * Nimmt eine Kundennachricht aus dem Website-Widget entgegen, führt das Gespräch weiter
 * und legt den Beratungsfall an bzw. aktualisiert ihn. Antwort enthält keine gespeicherten Falldaten.
 */
export const POST = publicRoute("widget-message", 40, async (req) => {
  const body = await parseBody(req, widgetMessageSchema);
  if (!body.ok) return body.res;
  const store = await getPublicStore(body.data.companyId);
  if (!store) return apiError("Unbekannte Company", 404);
  try {
    const turn = await processChatMessage(store, { sessionId: body.data.sessionId, text: body.data.text, source: "widget" });
    const { fields: _fields, ...publicTurn } = turn;
    void _fields;
    return json(publicTurn);
  } catch (err) {
    if (err instanceof SessionNotFoundError) return apiError("Sitzung nicht gefunden", 404);
    throw err;
  }
});
