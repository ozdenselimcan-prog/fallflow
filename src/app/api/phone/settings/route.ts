import { json, withSession } from "@/lib/api";
import { phoneMinutesFor } from "@/lib/config/pricing";
import { phoneRepo } from "@/lib/phone/calls";

/** Telefon-Assistent im Dashboard: zugeordnete Nummer, verbrauchte Minuten und letzte Anrufe. */
export const GET = withSession(async (_req, { store, session }) => {
  const repo = phoneRepo();
  const subscription = await store.getSubscription();
  const [number, minutes, calls] = repo
    ? await Promise.all([repo.numberForCompany(session.companyId), repo.minutesThisMonth(session.companyId), repo.recentCalls(session.companyId, 10)])
    : [null, 0, []];
  return json({
    number,
    minutesUsed: minutes,
    includedMinutes: phoneMinutesFor(subscription.plan),
    plan: subscription.plan,
    calls: calls.map((c) => ({ id: c.callSid.slice(-8), from: c.fromNumber, startedAt: c.startedAt, durationSec: c.durationSec, caseId: c.caseId, status: c.status })),
  });
});
