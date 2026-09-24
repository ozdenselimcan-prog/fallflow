import { apiError, json, parseBody, publicRoute } from "@/lib/api";
import { getPublicStore } from "@/lib/data";
import { processIntakeMessage, SessionNotFoundError } from "@/lib/intake/engine";
import { widgetMessageSchema } from "@/lib/validation";

/**
 * Nimmt eine Kundennachricht aus dem Website-Widget entgegen, führt das Gespräch weiter
 * und legt den Beratungsfall an bzw. aktualisiert ihn. Die Antwort enthält keine gespeicherten Falldaten –
 * nur die Antworttexte und ggf. den Upload-Link für angeforderte Dokumente.
 */
export const POST = publicRoute("widget-message", 40, async (req) => {
  const body = await parseBody(req, widgetMessageSchema);
  if (!body.ok) return body.res;
  const store = await getPublicStore(body.data.companyId);
  if (!store) return apiError("Unbekannte Company", 404);
  try {
    const turn = await processIntakeMessage(store, { sessionId: body.data.sessionId, text: body.data.text, source: "widget", channel: "website" });
    return json({
      sessionId: turn.sessionId,
      replies: turn.replies,
      quickReplies: turn.quickReplies,
      done: turn.done,
      completeness: turn.completeness,
      upload: turn.upload,
    });
  } catch (err) {
    if (err instanceof SessionNotFoundError) return apiError("Sitzung nicht gefunden", 404);
    throw err;
  }
});
