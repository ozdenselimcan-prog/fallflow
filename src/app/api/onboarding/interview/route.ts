import { json, parseBody, withSession } from "@/lib/api";
import { applyInterviewAnswer, interviewAnswerSchema } from "@/lib/intake/interview-answers";

/**
 * Einrichtungs-Gespräch (components/onboarding/interview.tsx): speichert eine einzelne Antwort sofort. Leistungen, Angaben,
 * Unterlagen und "Hier antworte ich selbst" laufen über PUT /api/business-profile – hier nur, was zusätzlich dazukommt.
 */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, interviewAnswerSchema);
    if (!body.ok) return body.res;
    await applyInterviewAnswer(store, body.data);
    return json({ ok: true });
  },
  { permission: "company:manage" },
);
