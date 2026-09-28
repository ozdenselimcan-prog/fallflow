import { json, parseBody, withSession } from "@/lib/api";
import { onboardingSchema } from "@/lib/validation";

/** Schließt das Onboarding ab: Firmendaten, Leistungen, aktive Erfassungsfelder und Terminverfügbarkeit. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, onboardingSchema);
    if (!body.ok) return body.res;
    const { activeFieldKeys, availability, ...company } = body.data;
    await store.updateCompany({ ...company, onboardingCompleted: true });
    await store.setActiveQuestionKeys(activeFieldKeys);
    const assistant = await store.getAssistant();
    await store.saveAssistant({ ...assistant, ...availability });
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
