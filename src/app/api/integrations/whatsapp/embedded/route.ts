import { randomInt, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, json, withSession } from "@/lib/api";
import { siteConfig } from "@/lib/config/site";
import { encryptionAvailable } from "@/lib/crypto";
import { saveConnection } from "@/lib/integrations/connections-store";
import { checkWhatsAppNumber, embeddedSignupConfig, exchangeSignupCode, findSignupNumber, registerNumber, signupDialogUrl, subscribeWaba } from "@/lib/integrations/whatsapp";

const STATE_COOKIE = "ff_oauth_whatsapp";
const RETURN_COOKIE = "ff_oauth_whatsapp_return";
/** Wohin nach der Anmeldung zurück – nur bekannte Seiten, nie beliebige Adressen. */
const RETURN_PATHS = ["/dashboard/settings/connections", "/onboarding"];

/**
 * Rückleitungs-Adresse der Anmeldung per Facebook. Muss in Meta unter „Facebook Login for Business → Einstellungen →
 * Gültige OAuth-Redirect-URIs“ eingetragen sein. Feste Adresse statt JS-SDK: Dessen Codes verlangen beim Einlösen eine
 * interne redirect_uri des SDK, die wir nicht kennen.
 */
const redirectUri = () => `${siteConfig.appUrl}/api/integrations/whatsapp/embedded`;

const back = (path: string, result: string) => NextResponse.redirect(new URL(`${path}?${new URLSearchParams({ integration: result })}`, siteConfig.appUrl));

/** POST: Anmeldung per Facebook (Embedded Signup) starten – liefert die Meta-Anmeldeseite. */
export const POST = withSession(
  async (req) => {
    const config = embeddedSignupConfig();
    if (!config) return apiError("Die Anmeldung per Facebook ist noch nicht eingerichtet.", 503);
    if (!encryptionAvailable()) return apiError("Verbindungen sind serverseitig noch nicht eingerichtet (CONNECTIONS_SECRET fehlt).", 503);
    const body = (await req.json().catch(() => ({}))) as { returnTo?: string };
    const state = randomUUID();
    const res = json({ authUrl: signupDialogUrl(config, redirectUri(), state) });
    const cookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 900, path: "/api/integrations" };
    res.cookies.set(STATE_COOKIE, state, cookie);
    res.cookies.set(RETURN_COOKIE, RETURN_PATHS.find((p) => p === body.returnTo) ?? RETURN_PATHS[0], cookie);
    return res;
  },
  { permission: "company:manage" },
);

/**
 * GET: Rückleitung von Meta – Code → dauerhafter Token des Betriebs, Nummer ermitteln und freischalten, App für das
 * WhatsApp-Konto anmelden, Verbindung verschlüsselt speichern.
 */
export const GET = withSession(async (req, { session }) => {
  const params = req.nextUrl.searchParams;
  const returnTo = RETURN_PATHS.find((p) => p === req.cookies.get(RETURN_COOKIE)?.value) ?? RETURN_PATHS[0];
  const done = (result: string) => {
    const res = back(returnTo, result);
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(RETURN_COOKIE);
    return res;
  };
  if (params.get("error")) return done("whatsapp-denied");
  const code = params.get("code");
  if (!code || params.get("state") !== req.cookies.get(STATE_COOKIE)?.value) return done("whatsapp-error");
  if (!embeddedSignupConfig() || !encryptionAvailable()) return done("whatsapp-error");

  let token: string;
  try {
    token = await exchangeSignupCode(code, redirectUri());
  } catch (err) {
    console.error("[whatsapp] Anmeldung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return done("whatsapp-failed");
  }
  const ids = await findSignupNumber(token).catch((err) => {
    console.error("[whatsapp] Nummer nicht ermittelbar:", err instanceof Error ? err.message : "unbekannt");
    return null;
  });
  if (!ids) return done("whatsapp-no-number");
  const pin = String(randomInt(100000, 999999));
  await registerNumber(token, ids.phoneNumberId, pin);
  try {
    await subscribeWaba(token, ids.wabaId);
  } catch (err) {
    console.error("[whatsapp] subscribed_apps fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return done("whatsapp-failed");
  }
  const info = await checkWhatsAppNumber(token, ids.phoneNumberId).catch(() => ({ display: "", name: "" }));
  await saveConnection({
    companyId: session.companyId,
    provider: "whatsapp",
    status: "connected",
    accountName: info.display,
    accountEmail: info.name,
    accessToken: token,
    refreshToken: null,
    expiresAt: null,
    metadata: { phoneNumberId: ids.phoneNumberId, wabaId: ids.wabaId, pin, viaSignup: true },
    lastError: "",
  });
  return done("whatsapp-connected");
});
