import { apiError, json, parseBody, withSession } from "@/lib/api";
import { encryptionAvailable } from "@/lib/crypto";
import { deleteConnection, getConnection, saveConnection, toStatus } from "@/lib/integrations/connections-store";
import { appConfigured } from "@/lib/integrations/whatsapp";
import { whatsappConnectSchema } from "@/lib/validation";

/**
 * WhatsApp Business Cloud API. FallFlow bietet dafür bewusst kein OAuth ("Login with Facebook"), das
 * erfordert eine eigene Meta-App-Prüfung mit Embedded Signup. Stattdessen trägt jedes Büro seinen
 * eigenen, in der Meta Business Suite erzeugten Zugriffstoken und die Telefonnummer-ID selbst ein.
 * Vor dem Speichern wird der Token gegen die echte Graph-API geprüft – kein Fake-„verbunden“.
 */
export const GET = withSession(async (_req, { session }) => {
  const connection = await getConnection(session.companyId, "whatsapp");
  return json({ appConfigured: appConfigured(), encryptionAvailable: encryptionAvailable(), connection: connection ? toStatus(connection) : null });
});

export const POST = withSession(
  async (req, { store, session }) => {
    if (!appConfigured()) return apiError("WhatsApp ist bei FallFlow noch nicht konfiguriert (App-Zugangsdaten fehlen).", 503);
    if (!encryptionAvailable()) return apiError("Kanal-Verbindungen sind serverseitig noch nicht eingerichtet.", 503);
    const body = await parseBody(req, whatsappConnectSchema);
    if (!body.ok) return body.res;

    const check = await fetch(`https://graph.facebook.com/v20.0/${body.data.phoneNumberId}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${body.data.accessToken}` },
    });
    if (!check.ok) return apiError("Der Zugriffstoken oder die Telefonnummer-ID wurde von Meta abgelehnt. Bitte prüfen Sie beide Werte.", 400);
    const info = (await check.json()) as { display_phone_number?: string; verified_name?: string };

    await saveConnection({
      companyId: session.companyId,
      provider: "whatsapp",
      status: "connected",
      accountName: info.verified_name ?? "",
      accountEmail: info.display_phone_number ?? body.data.phoneNumberId,
      accessToken: body.data.accessToken,
      refreshToken: null,
      expiresAt: null,
      metadata: { phoneNumberId: body.data.phoneNumberId, wabaId: body.data.wabaId ?? "" },
      lastSyncedAt: null,
      lastError: "",
    });
    await store.setChannelStatus("whatsapp", "connected", info.display_phone_number ?? "");
    return json({ ok: true, accountEmail: info.display_phone_number ?? "" }, 201);
  },
  { permission: "company:manage" },
);

export const DELETE = withSession(
  async (_req, { store, session }) => {
    await deleteConnection(session.companyId, "whatsapp");
    await store.setChannelStatus("whatsapp", "disconnected", "");
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
