import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { encryptionAvailable } from "@/lib/crypto";
import { deleteConnection, getConnection, saveConnection, toStatus } from "@/lib/integrations/connections-store";
import { encodeCredentials, gmailProvider } from "@/lib/integrations/gmail";

/**
 * E-Mail-Verbindung per IMAP/SMTP (eigene Zugangsdaten des Büros, kein OAuth) – funktioniert mit Gmail
 * (per App-Passwort), Outlook, GMX, Web.de, IONOS, Strato usw. Die Route heißt weiterhin "gmail" (interner
 * Bezeichner aus der Zeit vor der Umstellung), das Feature selbst ist aber anbieterunabhängig.
 */
const connectSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(500),
  imapHost: z.string().trim().min(1).max(255),
  imapPort: z.coerce.number().int().min(1).max(65535),
  smtpHost: z.string().trim().min(1).max(255),
  smtpPort: z.coerce.number().int().min(1).max(65535),
});

export const GET = withSession(async (_req, { session }) => {
  const connection = await getConnection(session.companyId, "gmail");
  return json({ connected: connection?.status === "connected", connection: connection ? toStatus(connection) : null });
});

/** Testet die Zugangsdaten (IMAP-Login + SMTP-Verify) und speichert sie erst, wenn der Test erfolgreich war. */
export const POST = withSession(
  async (req, { store, session }) => {
    if (!encryptionAvailable()) return apiError("Kanal-Verbindungen sind serverseitig noch nicht eingerichtet (CONNECTIONS_SECRET fehlt).", 503);
    const body = await parseBody(req, connectSchema);
    if (!body.ok) return body.res;
    const creds = encodeCredentials(body.data);
    try {
      await gmailProvider.testConnection({ accessToken: creds, refreshToken: null, expiresAt: null });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unbekannter Fehler";
      return apiError(`Verbindung fehlgeschlagen: ${reason}. Bitte Zugangsdaten und Server-Einstellungen prüfen.`, 400);
    }
    await saveConnection({
      companyId: session.companyId,
      provider: "gmail",
      status: "connected",
      accountName: body.data.email,
      accountEmail: body.data.email,
      accessToken: creds,
      refreshToken: null,
      expiresAt: null,
      metadata: {},
      lastSyncedAt: null,
      lastError: "",
    });
    await store.setChannelStatus("gmail", "connected", body.data.email);
    return json({ ok: true }, 201);
  },
  { permission: "company:manage" },
);

export const DELETE = withSession(
  async (_req, { store, session }) => {
    await deleteConnection(session.companyId, "gmail");
    await store.setChannelStatus("gmail", "disconnected", "");
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
