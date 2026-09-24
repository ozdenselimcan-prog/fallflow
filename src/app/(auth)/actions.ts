"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";
import { rateLimit } from "@/lib/rate-limit";
import { createUserClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";
import { forgotSchema, loginSchema, passwordSchema, signupSchema } from "@/lib/validation";

export interface ActionResult {
  error?: string;
  message?: string;
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
    const { firstName, lastName, company, email, password } = parsed.data;
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
