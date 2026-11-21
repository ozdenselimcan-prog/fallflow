import { apiError, json, withSession } from "@/lib/api";
import { SUPPORT_DAYS, supportAccessActive } from "@/lib/auth/support";

/**
 * Der Betrieb erlaubt dem FallFlow-Support für einige Tage, sein Konto einzurichten (siehe lib/auth/support.ts), bzw.
 * zieht die Erlaubnis zurück. Im Support-Modus selbst nicht änderbar – verlängern kann nur der Betrieb.
 */
export const GET = withSession(async (_req, { store }) => {
  const access = (await store.getCompany()).businessProfile.supportAccess;
  return json({ active: supportAccessActive(access), until: access?.until ?? null, lastUsedAt: access?.lastUsedAt ?? null });
});

export const POST = withSession(
  async (_req, { store, session }) => {
    if (session.support) return apiError("Im Support-Modus nicht möglich", 403);
    const company = await store.getCompany();
    const now = new Date();
    const supportAccess = { grantedAt: now.toISOString(), until: new Date(now.getTime() + SUPPORT_DAYS * 86_400_000).toISOString(), grantedBy: session.email };
    await store.updateCompany({ businessProfile: { ...company.businessProfile, supportAccess } });
    return json({ active: true, until: supportAccess.until, lastUsedAt: null });
  },
  { permission: "company:manage" },
);

export const DELETE = withSession(
  async (_req, { store, session }) => {
    if (session.support) return apiError("Im Support-Modus nicht möglich", 403);
    const company = await store.getCompany();
    const businessProfile = { ...company.businessProfile };
    delete businessProfile.supportAccess;
    await store.updateCompany({ businessProfile });
    return json({ active: false, until: null, lastUsedAt: null });
  },
  { permission: "company:manage" },
);
