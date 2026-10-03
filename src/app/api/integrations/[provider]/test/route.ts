import { z } from "zod";
import { apiError, json, withSession } from "@/lib/api";
import { saveConnection } from "@/lib/integrations/connections-store";
import { gmailProvider } from "@/lib/integrations/gmail";
import { microsoftProvider } from "@/lib/integrations/microsoft";
import { getValidTokens } from "@/lib/integrations/tokens";

const providerSchema = z.enum(["gmail", "microsoft"]);
const EMAIL_PROVIDERS = { gmail: gmailProvider, microsoft: microsoftProvider } as const;

/** „Verbindung testen“: ruft den Kanal mit den gespeicherten Zugangsdaten dieses Büros einmal leicht auf. */
export const POST = withSession(
  async (_req, { session }, ctx: RouteContext<"/api/integrations/[provider]/test">) => {
    const { provider: raw } = await ctx.params;
    const parsed = providerSchema.safeParse(raw);
    if (!parsed.success) return apiError("Unbekannter Kanal", 404);
    const provider = parsed.data;

    const emailProvider = EMAIL_PROVIDERS[provider];
    const found = await getValidTokens(emailProvider, session.companyId);
    if (!found) return apiError(`${emailProvider.label} ist nicht verbunden.`, 400);
    try {
      await emailProvider.testConnection(found.tokens);
      await saveConnection({ companyId: session.companyId, provider, status: "connected", lastSyncedAt: new Date().toISOString(), lastError: "" });
      return json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test fehlgeschlagen";
      await saveConnection({ companyId: session.companyId, provider, status: "error", lastError: message });
      return apiError("Der Test ist fehlgeschlagen. Bitte die Verbindung erneut einrichten.", 400);
    }
  },
  { permission: "company:manage" },
);
