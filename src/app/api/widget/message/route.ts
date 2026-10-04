import { apiError, json, parseBody, publicRoute } from "@/lib/api";
import { CASE_LIMIT_REACHED_TEXT } from "@/lib/billing/limits";
import { getPublicStore } from "@/lib/data";
import { CaseLimitReachedError, processIntakeMessage, SessionNotFoundError } from "@/lib/intake/engine";
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
    const turn = await processIntakeMessage(store, { companyId: body.data.companyId, sessionId: body.data.sessionId, text: body.data.text, source: "widget", channel: "website" });
    // Erste echte Widget-Anfrage dieses Falls: Kanal "Website" gilt erst jetzt als wirklich eingebunden,
    // nicht schon ab Signup (vorher stand faelschlich "verbunden", obwohl das Skript nirgends eingebaut war).
    if (turn.created) await store.setChannelStatus("website", "connected");
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
    if (err instanceof CaseLimitReachedError) {
      return json({ sessionId: null, replies: [CASE_LIMIT_REACHED_TEXT], quickReplies: [], done: true, completeness: 0, upload: null });
    }
    throw err;
  }
});
