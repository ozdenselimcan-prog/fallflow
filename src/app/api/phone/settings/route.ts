import { z } from "zod";
import { json, parseBody, withSession } from "@/lib/api";
import { PHONE_EXTRA_MINUTE_EUR, phoneMinutesFor } from "@/lib/config/pricing";
import { phoneRepo } from "@/lib/phone/calls";

/** Telefon-Assistent im Dashboard: zugeordnete Nummer, verbrauchte Minuten, letzte Anrufe, Limit-Einstellung. */
export const GET = withSession(async (_req, { store, session }) => {
  const repo = phoneRepo();
  const [company, subscription] = await Promise.all([store.getCompany(), store.getSubscription()]);
  const [number, minutes, calls] = repo
    ? await Promise.all([repo.numberForCompany(session.companyId), repo.minutesThisMonth(session.companyId), repo.recentCalls(session.companyId, 10)])
    : [null, 0, []];
  return json({
    number,
    minutesUsed: minutes,
    includedMinutes: phoneMinutesFor(subscription.plan),
    extraMinuteEur: PHONE_EXTRA_MINUTE_EUR,
    stopAtLimit: Boolean(company.businessProfile.phoneStopAtLimit),
    calls: calls.map((c) => ({ id: c.callSid.slice(-8), from: c.fromNumber, startedAt: c.startedAt, durationSec: c.durationSec, caseId: c.caseId, status: c.status })),
  });
});

const schema = z.object({ stopAtLimit: z.boolean() });

export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const company = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...company.businessProfile, phoneStopAtLimit: body.data.stopAtLimit } });
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
