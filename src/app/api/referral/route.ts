import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { getReferralOverview, normalizeReferralCode, referralCodeProblem } from "@/lib/billing/referrals";
import { createAdminClient } from "@/lib/supabase/clients";

const schema = z.object({ code: z.string().max(80) });

/** Eigenen Empfehlungslink umbenennen (fallflow.xyz/signup?ref=<code>). Bisherige Empfehlungen bleiben erhalten. */
export const PUT = withSession(
  async (req, { session }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const code = normalizeReferralCode(body.data.code);
    const problem = referralCodeProblem(code);
    if (problem) return apiError(problem, 400);
    const admin = createAdminClient();
    if (!admin) return apiError("Nicht verfügbar", 503);
    const { error } = await admin.from("referral_codes").update({ code }).eq("company_id", session.companyId);
    if (error?.code === "23505") return apiError("Dieser Name ist schon vergeben. Bitte wählen Sie einen anderen.", 409);
    if (error) return apiError("Der Link konnte nicht geändert werden.", 500);
    return json({ referral: await getReferralOverview(session.companyId) });
  },
  { permission: "company:manage" },
);
