import type { EmailProvider, ProviderTokens } from "./email";
import { getConnection, saveConnection, type Connection } from "./connections-store";

const REFRESH_MARGIN_MS = 5 * 60_000;

/**
 * Liefert für ein Büro gültige, entschlüsselte Zugangsdaten eines E-Mail-Anbieters. Erneuert den
 * Access Token automatisch, wenn er abgelaufen oder bald abläuft, und schreibt das Ergebnis zurück.
 * Gibt null zurück, wenn keine (funktionierende) Verbindung besteht.
 */
export async function getValidTokens(provider: EmailProvider, companyId: string): Promise<{ tokens: ProviderTokens; connection: Connection } | null> {
  const connection = await getConnection(companyId, provider.id);
  if (!connection || connection.status !== "connected" || !connection.accessToken) return null;

  const expiresAt = connection.expiresAt ? Date.parse(connection.expiresAt) : 0;
  if (!connection.refreshToken || Date.now() < expiresAt - REFRESH_MARGIN_MS) {
    return { tokens: { accessToken: connection.accessToken, refreshToken: connection.refreshToken, expiresAt: connection.expiresAt }, connection };
  }

  try {
    const refreshed = await provider.refreshTokens(connection.refreshToken);
    const expiresAtIso = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
    await saveConnection({
      companyId,
      provider: provider.id,
      status: "connected",
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? connection.refreshToken,
      expiresAt: expiresAtIso,
      lastError: "",
    });
    return { tokens: { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken ?? connection.refreshToken, expiresAt: expiresAtIso }, connection };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token-Erneuerung fehlgeschlagen";
    console.error(`[${provider.id}] Token-Erneuerung fehlgeschlagen für Büro ${companyId}:`, message);
    await saveConnection({ companyId, provider: provider.id, status: "error", lastError: message });
    return null;
  }
}
