import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, json, withSession } from "@/lib/api";
import { siteConfig } from "@/lib/config/site";
import { encryptionAvailable } from "@/lib/crypto";
import { deleteConnection, getConnection, saveConnection, toStatus } from "./connections-store";
import { IntegrationNotReadyError } from "./email";
import { CALENDAR_SCOPES, microsoftProvider } from "./microsoft";

const STATE_COOKIE = "ff_oauth_microsoft";
const RETURN_COOKIE = "ff_oauth_microsoft_return";
/** "calendar" = Anmeldung nur für den Outlook-Kalender (eigene Verbindung, Postfach bleibt unberührt). */
const PURPOSE_COOKIE = "ff_oauth_microsoft_purpose";
/** Wohin nach der Anmeldung zurück – nur bekannte Seiten, nie beliebige Adressen. */
const RETURN_PATHS = ["/dashboard/settings/connections", "/onboarding"];

/**
 * Bei Microsoft hinterlegte Rückleitungs-Adresse. Muss exakt so in der App-Registrierung (Azure → Authentifizierung)
 * eingetragen sein; über MICROSOFT_REDIRECT_URI anpassbar. Beide Pfade (…/microsoft und …/microsoft/callback)
 * verarbeiten die Rückleitung.
 */
export const microsoftRedirectUri = () => process.env.MICROSOFT_REDIRECT_URI || `${siteConfig.appUrl}/api/integrations/microsoft`;

const back = (path: string, params: Record<string, string>) => NextResponse.redirect(new URL(`${path}?${new URLSearchParams(params)}`, siteConfig.appUrl));

/** OAuth-Rückleitung von Microsoft: Code gegen Zugangsdaten tauschen und die Verbindung des Büros speichern. */
export const handleMicrosoftCallback = withSession(async (req: NextRequest, { store, session }) => {
  const params = req.nextUrl.searchParams;
  const returnTo = RETURN_PATHS.find((p) => p === req.cookies.get(RETURN_COOKIE)?.value) ?? RETURN_PATHS[0];
  if (params.get("error")) return back(returnTo, { integration: "microsoft-denied" });
  const code = params.get("code");
  if (!code || params.get("state") !== req.cookies.get(STATE_COOKIE)?.value) return back(returnTo, { integration: "microsoft-error" });
  if (req.cookies.get(PURPOSE_COOKIE)?.value === "calendar") {
    try {
      const result = await microsoftProvider.exchangeCode(code, microsoftRedirectUri(), CALENDAR_SCOPES);
      await saveConnection({
        companyId: session.companyId,
        provider: "outlook_calendar",
        status: "connected",
        accountName: result.account,
        accountEmail: result.account,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
        metadata: {},
        lastSyncedAt: null,
        lastError: "",
      });
    } catch (err) {
      console.error("[microsoft] Kalender-Anmeldung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
      return back(returnTo, { integration: "calendar-failed" });
    }
    const res = back(returnTo, { integration: "calendar-connected" });
    for (const c of [STATE_COOKIE, RETURN_COOKIE, PURPOSE_COOKIE]) res.cookies.delete(c);
    return res;
  }
  try {
    const result = await microsoftProvider.exchangeCode(code, microsoftRedirectUri());
    await saveConnection({
      companyId: session.companyId,
      provider: "microsoft",
      status: "connected",
      accountName: result.account,
      accountEmail: result.account,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
      metadata: {},
      lastSyncedAt: null,
      lastError: "",
    });
    // Ein Büro hat genau EIN verbundenes Postfach: eine ältere IMAP-Verbindung wird ersetzt.
    await deleteConnection(session.companyId, "gmail");
    await store.setChannelStatus("gmail", "connected", result.account);
  } catch (err) {
    console.error("[microsoft] Anmeldung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return back(returnTo, { integration: err instanceof IntegrationNotReadyError ? "microsoft-error" : "microsoft-failed" });
  }
  const res = back(returnTo, { integration: "microsoft-connected" });
  res.cookies.delete(STATE_COOKIE);
  res.cookies.delete(RETURN_COOKIE);
  return res;
});

/** GET: Status (oder Rückleitung, wenn ?code/?error dabei ist). */
export const GET = withSession(async (req, ctx) => {
  if (req.nextUrl.searchParams.has("code") || req.nextUrl.searchParams.has("error")) return handleMicrosoftCallback(req);
  const [connection, calendar] = await Promise.all([getConnection(ctx.session.companyId, "microsoft"), getConnection(ctx.session.companyId, "outlook_calendar")]);
  return json({
    available: microsoftProvider.missingConfig().length === 0,
    missingConfig: microsoftProvider.missingConfig(),
    connected: connection?.status === "connected",
    connection: connection ? toStatus(connection) : null,
    calendar: calendar ? { status: calendar.status, account: calendar.accountEmail, lastError: calendar.lastError } : null,
  });
});

/** POST: Anmeldung starten – liefert die Microsoft-Anmeldeseite. */
export const POST = withSession(
  async (req) => {
    if (microsoftProvider.missingConfig().length) return apiError("Die Anmeldung über Microsoft ist noch nicht eingerichtet.", 503);
    if (!encryptionAvailable()) return apiError("Kanal-Verbindungen sind serverseitig noch nicht eingerichtet (CONNECTIONS_SECRET fehlt).", 503);
    const body = (await req.json().catch(() => ({}))) as { returnTo?: string; purpose?: string };
    const calendar = body.purpose === "calendar";
    const state = randomUUID();
    const res = json({ authUrl: microsoftProvider.getAuthUrl(state, microsoftRedirectUri(), calendar ? CALENDAR_SCOPES : undefined) });
    const cookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/api/integrations" };
    res.cookies.set(STATE_COOKIE, state, cookie);
    res.cookies.set(RETURN_COOKIE, RETURN_PATHS.find((p) => p === body.returnTo) ?? RETURN_PATHS[0], cookie);
    if (calendar) res.cookies.set(PURPOSE_COOKIE, "calendar", cookie);
    else res.cookies.delete(PURPOSE_COOKIE);
    return res;
  },
  { permission: "company:manage" },
);

/** DELETE: Microsoft-Verbindung dieses Büros trennen (?purpose=calendar: nur den Kalender). */
export const DELETE = withSession(
  async (req, { store, session }) => {
    if (req.nextUrl.searchParams.get("purpose") === "calendar") {
      await deleteConnection(session.companyId, "outlook_calendar");
      return json({ ok: true });
    }
    await deleteConnection(session.companyId, "microsoft");
    await store.setChannelStatus("gmail", "disconnected", "");
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
