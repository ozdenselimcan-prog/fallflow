"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { REFERRAL_CODE } from "@/lib/billing/referrals";
import { hasUsedTrial } from "@/lib/billing/trial-usage";
import { siteConfig } from "@/lib/config/site";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient, createUserClient } from "@/lib/supabase/clients";
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
    // Supabase meldet "nicht bestätigt" nur bei richtigem Passwort – sonst bewusst generisch (keine Auskunft, ob die E-Mail existiert).
    if (error?.code === "email_not_confirmed") return { error: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse – den Link dazu haben wir Ihnen bei der Registrierung geschickt." };
    if (error) return { error: "E-Mail oder Passwort ist nicht korrekt." };
  }
  redirect("/dashboard");
}

/** Speichert das Ende der kostenlosen Testphase beim gerade angelegten Büro (nur, solange noch kein Stripe-Abo besteht). */
async function setTrialEnd(userId: string, trialDays: number) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: member } = await admin.from("company_members").select("company_id").eq("user_id", userId).eq("role", "OWNER").maybeSingle();
  if (!member?.company_id) return;
  // 0 Tage (Direktkauf): Ende = jetzt → FallFlow zeigt sofort die Bezahlseite (siehe isDirectPurchase).
  const end = new Date(Date.now() + trialDays * 86_400_000).toISOString();
  // Nur, wenn noch kein Ende gesetzt ist: Eine erneute Registrierung mit derselben (noch unbestätigten) Adresse darf eine
  // laufende Testphase nie verkürzen.
  await admin.from("subscriptions").update({ current_period_end: end }).eq("company_id", member.company_id).is("stripe_customer_id", null).is("current_period_end", null);
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
  // Empfehlungscode eines anderen Büros – die Zuordnung übernimmt ein Datenbank-Trigger (Migration 0023).
  const rawRef = typeof input === "object" && input !== null ? (input as Record<string, unknown>).referralCode : undefined;
  const ref = typeof rawRef === "string" && REFERRAL_CODE.test(rawRef) ? rawRef : undefined;
  // "Direkt kaufen" auf der Preisseite: keine Testphase, nach der Registrierung sofort zur Bezahlung.
  const buy = typeof input === "object" && input !== null && (input as Record<string, unknown>).buy === true;

  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    const { firstName, lastName, company, email, password, plan } = parsed.data;
    // Die kostenlose Testphase gibt es nur einmal je E-Mail-Adresse – auch nach Löschung des Kontos.
    const trialUsedBefore = !buy && (await hasUsedTrial(email));
    const direct = buy || trialUsedBefore;
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        // Zustimmung zu AGB/AVV mit Zeitpunkt und Fassung am Konto festhalten (Nachweis).
        data: { first_name: firstName, last_name: lastName, company, terms_accepted_at: new Date().toISOString(), terms_version: LEGAL_VERSION, signup_plan: plan ?? "starter", trial_days: direct ? 0 : trialDays, ...(trialUsedBefore ? { trial_used_before: true } : {}), ...(ref ? { ref } : {}) },
        emailRedirectTo: `${siteConfig.appUrl}/auth/confirm?next=${direct ? "/dashboard" : "/onboarding"}`,
      },
    });
    // Zweiter Versuch kurz nach der ersten Registrierung: Die Bestätigungsmail ist schon unterwegs.
    if (error?.code === "over_email_send_rate_limit" || error?.status === 429)
      return { message: `Wir haben Ihnen bereits eine E-Mail an ${email} geschickt. Bitte klicken Sie auf den Link darin, um Ihre E-Mail-Adresse zu bestätigen. (Keine Mail? Bitte auch im Spam-Ordner nachsehen – nach einigen Minuten können Sie es erneut versuchen.)` };
    if (error) return { error: "Die Registrierung war nicht möglich. Bitte prüfen Sie Ihre Angaben." };
    // Testphase ohne Zahlungsmethode: Ende festhalten (7 Tage bzw. Testzeitraum aus dem Link). Danach zeigt FallFlow nur
    // noch die Bezahlseite (siehe lib/billing/access.ts). Fehler hier blockieren die Registrierung nicht (dann gilt Anlage + 7 Tage).
    if (data.user) await setTrialEnd(data.user.id, direct ? 0 : trialDays).catch((err) => console.error("[signup] Testphase:", err instanceof Error ? err.message : "Fehler"));
    // Als "Testphase genutzt" zählt die Adresse erst nach der Bestätigung (siehe /auth/confirm) – sonst würde eine zweite
    // Registrierung vor dem Klick auf den Bestätigungslink die Testphase verlieren.
    if (!data.session) return { message: `Fast geschafft! Wir haben Ihnen eine E-Mail an ${email} geschickt. Bitte klicken Sie auf den Link darin, um Ihre E-Mail-Adresse zu bestätigen – danach geht es direkt weiter. (Keine Mail? Bitte auch im Spam-Ordner nachsehen.)` };
    // Direktkauf: Das Dashboard zeigt zuerst die Bezahlseite, eingerichtet wird danach.
    if (direct) redirect("/dashboard");
  }
  redirect("/onboarding");
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await throttle("forgot"))) return TOO_MANY;

  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    await db.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${siteConfig.appUrl}/auth/confirm?next=/reset-password` });
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
