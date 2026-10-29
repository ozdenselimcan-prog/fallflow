import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { encryptionAvailable } from "@/lib/crypto";
import { deleteConnection, getConnection, saveConnection } from "@/lib/integrations/connections-store";
import { checkWhatsAppNumber, embeddedSignupConfig, subscribeApp } from "@/lib/integrations/whatsapp";

/** WhatsApp Business verbinden: Telefonnummer-ID + Zugangstoken (aus Meta), werden geprüft und verschlüsselt gespeichert. */
export const GET = withSession(async (_req, { session }) => {
  const c = await getConnection(session.companyId, "whatsapp").catch(() => null);
  return json({
    available: Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN),
    embedded: embeddedSignupConfig(),
    connection: c ? { status: c.status, number: c.accountName, name: c.accountEmail, lastError: c.lastError, lastSyncedAt: c.lastSyncedAt } : null,
  });
});

const schema = z.object({ phoneNumberId: z.string().trim().regex(/^\d{6,25}$/, "Die Telefonnummer-ID besteht nur aus Ziffern"), accessToken: z.string().trim().min(20).max(1000) });

export const POST = withSession(
  async (req, { session }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    if (!encryptionAvailable()) return apiError("Verbindungen sind serverseitig noch nicht eingerichtet (CONNECTIONS_SECRET fehlt).", 503);
    let info: { display: string; name: string };
    try {
      info = await checkWhatsAppNumber(body.data.accessToken, body.data.phoneNumberId);
    } catch {
      return apiError("Meta hat die Angaben nicht akzeptiert. Bitte Telefonnummer-ID und Zugangstoken prüfen.", 400);
    }
    await saveConnection({
      companyId: session.companyId,
      provider: "whatsapp",
      status: "connected",
      accountName: info.display,
      accountEmail: info.name,
      accessToken: body.data.accessToken,
      refreshToken: null,
      expiresAt: null,
      metadata: { phoneNumberId: body.data.phoneNumberId, subscribedAccounts: await subscribeApp(body.data.accessToken) },
      lastError: "",
    });
    return json({ ok: true, number: info.display, name: info.name });
  },
  { permission: "company:manage" },
);

export const DELETE = withSession(
  async (_req, { session }) => {
    await deleteConnection(session.companyId, "whatsapp");
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
