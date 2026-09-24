import { json, parseBody, withSession } from "@/lib/api";
import { onboardingSchema } from "@/lib/validation";

/** Schließt das Onboarding ab: Firmendaten, Leistungen und aktive Erfassungsfelder. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, onboardingSchema);
    if (!body.ok) return body.res;
    const { activeFieldKeys, ...company } = body.data;
    await store.updateCompany({ ...company, onboardingCompleted: true });
    await store.setActiveQuestionKeys(activeFieldKeys);
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
