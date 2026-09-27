import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, json, withSession } from "@/lib/api";
import { siteConfig } from "@/lib/config/site";
import { encryptionAvailable } from "@/lib/crypto";
import { deleteConnection, getConnection, saveConnection, toStatus } from "./connections-store";
import { IntegrationNotReadyError, type EmailProvider } from "./email";

/**
 * Gemeinsame Route-Logik für Gmail/Microsoft. FallFlow hat pro Anbieter eine App-Identität
 * (CLIENT_ID/SECRET als Vercel-Variablen); die Zugangsdaten des jeweiligen Kunden-Postfachs werden
 * nach dem OAuth-Austausch ausschließlich in `connections` (verschlüsselt, service-role-only) abgelegt.
 *
 * GET               → Status dieses Büros (fehlende App-Konfiguration, verbunden, Fehler)
 * POST              → OAuth-Start: liefert die Autorisierungs-URL
 * GET ?code=&state= → OAuth-Callback: tauscht den Code gegen Tokens und speichert die Verbindung
 * DELETE            → trennt die Verbindung dieses Büros
 */
export function createOAuthRoute(provider: EmailProvider) {
  const redirectUri = `${siteConfig.appUrl}/api/integrations/${provider.id}`;
  const stateCookie = `ff_oauth_${provider.id}`;

  const GET = withSession(async (req, { store, session }) => {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      const missing = provider.missingConfig();
      const connection = await getConnection(session.companyId, provider.id);
      return json({
        provider: provider.id,
        mode: missing.length ? "mock" : "live",
        missingConfig: missing,
        connected: connection?.status === "connected",
        connection: connection ? toStatus(connection) : null,
      });
    }
    if (req.nextUrl.searchParams.get("state") !== req.cookies.get(stateCookie)?.value) return apiError("Ungültiger OAuth-State", 400);
    try {
      const result = await provider.exchangeCode(code, redirectUri);
      await saveConnection({
        companyId: session.companyId,
        provider: provider.id,
        status: "connected",
        accountName: result.account,
        accountEmail: result.account,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
        lastSyncedAt: null,
        lastError: "",
      });
      await store.setChannelStatus(provider.id, "connected", result.account);
    } catch (err) {
      if (err instanceof IntegrationNotReadyError) {
        return NextResponse.redirect(new URL(`/dashboard/settings/connections?integration=not-ready&provider=${provider.id}`, siteConfig.appUrl));
      }
      throw err;
    }
    return NextResponse.redirect(new URL("/dashboard/settings/connections", siteConfig.appUrl));
  });

  const POST = withSession(
    async () => {
      const missing = provider.missingConfig();
      if (missing.length) return json({ mode: "mock", connected: false, missingConfig: missing, message: `${provider.label} ist bei FallFlow noch nicht konfiguriert (fehlt: ${missing.join(", ")}).` });
      if (!encryptionAvailable()) return json({ mode: "mock", connected: false, message: "Kanal-Verbindungen sind serverseitig noch nicht eingerichtet (CONNECTIONS_SECRET fehlt)." });
      const state = randomUUID();
      const res = json({ mode: "live", authUrl: provider.getAuthUrl(state, redirectUri) });
      res.cookies.set(stateCookie, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/api/integrations" });
      return res;
    },
    { permission: "company:manage" },
  );

  const DELETE = withSession(
    async (_req, { store, session }) => {
      await deleteConnection(session.companyId, provider.id);
      await store.setChannelStatus(provider.id, "disconnected", "");
      return json({ ok: true });
    },
    { permission: "company:manage" },
  );

  return { GET, POST, DELETE };
}

export { toStatus };
