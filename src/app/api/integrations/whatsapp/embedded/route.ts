import { randomInt } from "node:crypto";
import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { encryptionAvailable } from "@/lib/crypto";
import { saveConnection } from "@/lib/integrations/connections-store";
import { checkWhatsAppNumber, embeddedSignupConfig, exchangeSignupCode, registerNumber, subscribeWaba } from "@/lib/integrations/whatsapp";

const schema = z.object({
  code: z.string().trim().min(10).max(2000),
  phoneNumberId: z.string().trim().regex(/^\d{6,25}$/),
  wabaId: z.string().trim().regex(/^\d{6,25}$/),
});

/**
 * Abschluss der Anmeldung per Facebook (Embedded Signup): Code → dauerhafter Token des Betriebs, Nummer freischalten,
 * App für das WhatsApp-Konto anmelden, Verbindung verschlüsselt speichern.
 */
export const POST = withSession(
  async (req, { session }) => {
    if (!embeddedSignupConfig()) return apiError("Die Anmeldung per Facebook ist noch nicht eingerichtet.", 503);
    if (!encryptionAvailable()) return apiError("Verbindungen sind serverseitig noch nicht eingerichtet (CONNECTIONS_SECRET fehlt).", 503);
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    let token: string;
    try {
      token = await exchangeSignupCode(body.data.code);
    } catch (err) {
      console.error("[whatsapp] Anmeldung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
      return apiError("Die Anmeldung bei Meta ist fehlgeschlagen. Bitte noch einmal versuchen.", 400);
    }
    const pin = String(randomInt(100000, 999999));
    await registerNumber(token, body.data.phoneNumberId, pin);
    try {
      await subscribeWaba(token, body.data.wabaId);
    } catch (err) {
      console.error("[whatsapp] subscribed_apps fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
      return apiError("Ihr WhatsApp-Konto konnte nicht mit FallFlow verbunden werden. Bitte noch einmal versuchen.", 400);
    }
    const info = await checkWhatsAppNumber(token, body.data.phoneNumberId).catch(() => ({ display: "", name: "" }));
    await saveConnection({
      companyId: session.companyId,
      provider: "whatsapp",
      status: "connected",
      accountName: info.display,
      accountEmail: info.name,
      accessToken: token,
      refreshToken: null,
      expiresAt: null,
      metadata: { phoneNumberId: body.data.phoneNumberId, wabaId: body.data.wabaId, pin, viaSignup: true },
      lastError: "",
    });
    return json({ ok: true, number: info.display, name: info.name });
  },
  { permission: "company:manage" },
);
