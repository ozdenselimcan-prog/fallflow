import { apiError, json, parseBody, publicRoute } from "@/lib/api";
import { getPublicStore } from "@/lib/data";
import { answerWebsiteChat, chatTurnOf } from "@/lib/intake/website-chat";
import { widgetMessageSchema } from "@/lib/validation";

/**
 * Beantwortet eine Kundennachricht aus dem Website-Widget. Der Website-Chat ist ein reiner Frage-Antwort-Assistent:
 * Es wird kein Beratungsfall angelegt und nichts gespeichert – Anfragen und Termine laufen per E-Mail oder Telefon.
 */
export const POST = publicRoute("widget-message", 40, async (req) => {
  const body = await parseBody(req, widgetMessageSchema);
  if (!body.ok) return body.res;
  const store = await getPublicStore(body.data.companyId);
  if (!store) return apiError("Unbekannte Company", 404);
  if ((await store.getSubscription()).status === "canceled") return json(chatTurnOf("Der Chat ist derzeit leider nicht verfügbar. Bitte kontaktieren Sie uns direkt per E-Mail oder Telefon."));
  const history = body.data.history ?? [];
  // Erste Nachricht über ein echt eingebundenes Widget (iframe via widget.js): Kanal "Website" gilt als verbunden.
  // Ruft das Büro die Seite nur direkt auf (z. B. Vorschau-Link im Onboarding), bleibt er "nicht verbunden".
  if (body.data.embedded && history.length === 0) await store.setChannelStatus("website", "connected");
  return json(chatTurnOf(await answerWebsiteChat(store, body.data.text, history)));
});
