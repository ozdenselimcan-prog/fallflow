"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";
import { createCheckoutSession, stripeConfigured } from "@/lib/integrations/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { createUserClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";
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

  if (isSupabaseConfigured()) {
    const db = await createUserClient();
    const { firstName, lastName, company, email, password, plan } = parsed.data;
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, company },
        emailRedirectTo: `${siteConfig.appUrl}/auth/callback?next=/onboarding`,
      },
    });
    if (error) return { error: "Die Registrierung war nicht möglich. Bitte prüfen Sie Ihre Angaben." };
    if (!data.session) return { message: "Fast geschafft: Wir haben Ihnen eine E-Mail zur Bestätigung geschickt." };

    // 7 Tage kostenlose Testphase, aber wie ein Vertrag: Zahlungsmethode wird sofort erfasst,
    // nach Ablauf bucht Stripe automatisch ab. Ohne Stripe-Konfiguration einfach ohne Testphase weiter.
    if (stripeConfigured() && data.user) {
      // Die company_members-Zeile wird per Datenbank-Trigger direkt nach der Registrierung angelegt; in
      // seltenen Fällen ist sie im selben Request noch nicht sichtbar. Kurz erneut versuchen, statt den
      // Kunden sonst ohne Fehlermeldung und ohne Stripe-Vertrag in die Testphase laufen zu lassen.
      let member: { company_id: string } | null = null;
      for (let attempt = 0; attempt < 4 && !member; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 400));
        member = (await db.from("company_members").select("company_id").eq("user_id", data.user.id).maybeSingle()).data;
      }
      if (member?.company_id) {
        let checkoutUrl: string | null = null;
        try {
          checkoutUrl = await createCheckoutSession({
            companyId: member.company_id,
            planId: plan ?? "starter",
            customerEmail: email,
            existingCustomerId: null,
            trialDays: 7,
            successUrl: `${siteConfig.appUrl}/onboarding`,
            cancelUrl: `${siteConfig.appUrl}/onboarding`,
          });
        } catch (err) {
          console.error("[signup] Trial-Checkout fehlgeschlagen:", err instanceof Error ? err.message : "Fehler");
        }
        if (checkoutUrl) return { redirectTo: checkoutUrl };
      }
    }
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
