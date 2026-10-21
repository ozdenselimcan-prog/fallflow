import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { recordTrialUsage } from "@/lib/billing/trial-usage";
import { siteConfig } from "@/lib/config/site";
import { createUserClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Link aus der Bestätigungs- bzw. Passwort-Mail. Mit token_hash (eigene Mail-Vorlage) funktioniert er in jedem Browser –
 * auch wenn die Mail auf dem Handy geöffnet wird. Ältere Links mit ?code= werden wie bisher eingelöst.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const rawNext = params.get("next") ?? "/dashboard";
  // Nur interne Pfade zulassen (Open-Redirect-Schutz)
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    let ok = false;
    if (tokenHash && type && OTP_TYPES.includes(type)) ok = !(await db.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    else if (code) ok = !(await db.auth.exchangeCodeForSession(code)).error;
    if (ok) {
      // E-Mail-Adresse bestätigt: Ab jetzt gilt die kostenlose Testphase dieser Adresse als genutzt (einmal je Adresse).
      if (type === "signup" || type === "email" || code) {
        const { data } = await db.auth.getUser();
        if (data.user?.email && data.user.user_metadata?.trial_used_before !== true) await recordTrialUsage(data.user.email);
      }
      return NextResponse.redirect(new URL(next, siteConfig.appUrl));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", siteConfig.appUrl));
}
