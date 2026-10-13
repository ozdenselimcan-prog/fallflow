"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";
import { rateLimit } from "@/lib/rate-limit";
import { createUserClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";
import { LEGAL_VERSION } from "@/lib/config/legal";
import { forgotSchema, loginSchema, passwordSchema, signupSchema } from "@/lib/validation";

export interface ActionResult {
  error?: string;
  message?: string;
  /** Externe URL (z. B. Stripe Checkout), zu der der Browser weitergeleitet werden soll. redirect() aus einer
   * per JS aufgerufenen Server Action navigiert Next.js zuverlässig nur innerhalb der eigenen App, deshalb
   * übernimmt das Formular selbst die Weiterleitung per window.location. */
  redirectTo?: string;
}

async function throttle(scope: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return rateLimit(`auth:${scope}:${ip}`, 10, 10 * 60_000);
}

const TOO_MANY: ActionResult = { error: "Zu viele Versuche. Bitte warten Sie einige Minuten." };

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await throttle("login"))) return TOO_MANY;

  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    const { error } = await db.auth.signInWithPassword(parsed.data);
    // Bewusst generische Meldung: keine Auskunft, ob die E-Mail existiert.
    if (error) return { error: "E-Mail oder Passwort ist nicht korrekt." };
  }
  redirect("/dashboard");
}

export async function signupAction(input: unknown): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await throttle("signup"))) return TOO_MANY;

  // Standard 7 Tage; ein individueller Testzeitraum (z. B. 14 Tage für einen einzelnen Kunden) kommt nur
  // über den gezielt verschickten Signup-Link mit ?trial=14 (siehe signup/page.tsx), sonst bleibt es beim Standard.
  const rawTrialDays = typeof input === "object" && input !== null ? (input as Record<string, unknown>).trialDays : undefined;
  const trialDaysNum = Number(rawTrialDays);
  const trialDays = Number.isInteger(trialDaysNum) && trialDaysNum >= 1 && trialDaysNum <= 60 ? trialDaysNum : 7;

  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    const { firstName, lastName, company, email, password, plan } = parsed.data;
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        // Zustimmung zu AGB/AVV mit Zeitpunkt und Fassung am Konto festhalten (Nachweis).
        data: { first_name: firstName, last_name: lastName, company, terms_accepted_at: new Date().toISOString(), terms_version: LEGAL_VERSION, signup_plan: plan ?? "starter", trial_days: trialDays },
        emailRedirectTo: `${siteConfig.appUrl}/auth/callback?next=/onboarding`,
      },
    });
    if (error) return { error: "Die Registrierung war nicht möglich. Bitte prüfen Sie Ihre Angaben." };
    if (!data.session) return { message: "Fast geschafft: Wir haben Ihnen eine E-Mail zur Bestätigung geschickt." };

    // Erst das Onboarding (Fragebogen), danach die Zahlungsmethode: Das Dashboard zeigt nach dem Onboarding
    // "Testphase starten" mit dem hier gewählten Plan und Testzeitraum (siehe PaymentSetup).
  }
  redirect("/onboarding");
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await throttle("forgot"))) return TOO_MANY;

  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    await db.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${siteConfig.appUrl}/auth/callback?next=/reset-password` });
  }
  // Immer dieselbe Antwort, damit keine Konten enumeriert werden können.
  return { message: "Wenn ein Konto mit dieser E-Mail existiert, haben wir Ihnen einen Link zum Zurücksetzen gesendet." };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    const { error } = await db.auth.updateUser({ password: parsed.data });
    if (error) return { error: "Das Passwort konnte nicht geändert werden. Bitte fordern Sie einen neuen Link an." };
  }
  redirect("/dashboard");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    await db.auth.signOut();
  }
  redirect("/");
}
