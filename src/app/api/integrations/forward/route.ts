import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { saveConnection } from "@/lib/integrations/connections-store";
import { ensureForwarding, INBOUND_DOMAIN, toForwardingInfo } from "@/lib/integrations/forwarding";

/**
 * Weiterleitung an die FallFlow-Adresse des Betriebs (siehe lib/integrations/forwarding.ts): GET legt die Adresse beim
 * ersten Aufruf an, POST schaltet ein (mit der Adresse, die die Kunden kennen), DELETE schaltet wieder aus.
 */
const schema = z.object({ ownAddress: z.string().trim().toLowerCase().email() });

export const GET = withSession(async (_req, { session, store }) => {
  const company = await store.getCompany();
  const conn = await ensureForwarding(session.companyId, company.name, session.email);
  return json(toForwardingInfo(conn));
});

export const POST = withSession(
  async (req, { session, store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    if (body.data.ownAddress.endsWith(`@${INBOUND_DOMAIN}`)) return apiError("Bitte Ihre eigene E-Mail-Adresse eintragen – die Adresse, an die Ihre Kunden schreiben.", 400);
    const company = await store.getCompany();
    await ensureForwarding(session.companyId, company.name, session.email);
    await saveConnection({ companyId: session.companyId, provider: "forward", status: "connected", accountName: company.name, accountEmail: body.data.ownAddress, lastError: "" });
    return json({ ok: true });
  },
  { permission: "company:manage" },
);

export const DELETE = withSession(
  async (_req, { session }) => {
    await saveConnection({ companyId: session.companyId, provider: "forward", status: "disconnected" });
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
