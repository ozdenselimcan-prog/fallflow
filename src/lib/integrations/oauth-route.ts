import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, json, withSession } from "@/lib/api";
import { siteConfig } from "@/lib/config/site";
import { IntegrationNotReadyError, type EmailProvider } from "./email";

/**
 * Gemeinsame Route-Logik für Gmail/Microsoft.
 * GET               → Status (fehlende Konfiguration, kein Fake-"verbunden")
 * POST              → OAuth-Start: liefert die Autorisierungs-URL, sofern Credentials vorhanden sind
 * GET ?code=&state= → OAuth-Callback (Token-Austausch folgt, sobald echte Credentials vorliegen)
 */
export function createOAuthRoute(provider: EmailProvider) {
  const redirectUri = `${siteConfig.appUrl}/api/integrations/${provider.id}`;
  const stateCookie = `ff_oauth_${provider.id}`;

  const GET = withSession(async (req, { store }) => {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      const channel = (await store.listChannels()).find((c) => c.kind === provider.id);
      const missing = provider.missingConfig();
      return json({ provider: provider.id, mode: missing.length ? "mock" : "live", missingConfig: missing, connected: channel?.status === "connected" });
    }
    if (req.nextUrl.searchParams.get("state") !== req.cookies.get(stateCookie)?.value) return apiError("Ungültiger OAuth-State", 400);
    try {
      await provider.exchangeCode(code, redirectUri);
    } catch (err) {
      if (err instanceof IntegrationNotReadyError) return NextResponse.redirect(new URL("/dashboard/channels?integration=not-ready", siteConfig.appUrl));
      throw err;
    }
    return NextResponse.redirect(new URL("/dashboard/channels", siteConfig.appUrl));
  });

  const POST = withSession(
    async () => {
      const missing = provider.missingConfig();
      if (missing.length) {
        return json({ mode: "mock", connected: false, missingConfig: missing, message: `${provider.label} ist nicht verbunden: OAuth-Zugangsdaten fehlen (${missing.join(", ")}).` }, 200);
      }
      const state = randomUUID();
      const res = json({ mode: "live", authUrl: provider.getAuthUrl(state, redirectUri) });
      res.cookies.set(stateCookie, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/api/integrations" });
      return res;
    },
    { permission: "company:manage" },
  );

  return { GET, POST };
}
