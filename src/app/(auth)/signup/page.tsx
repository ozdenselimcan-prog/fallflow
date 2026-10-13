import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/auth-form";
import { REFERRAL_CODE, REFERRAL_TRIAL_DAYS } from "@/lib/billing/referrals";
import { plans } from "@/lib/config/pricing";

export const metadata: Metadata = { title: "Registrieren" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { plan: planParam, trial: trialParam, ref: refParam } = await searchParams;
  const plan = plans.find((p) => p.id === planParam) ?? plans[0];
  // Standard 7 Tage; ein individueller Testzeitraum (z. B. 14 Tage für einen einzelnen Kunden) läuft nur
  // über einen gezielt verschickten Link mit ?trial=14 (bis 60, z. B. ?trial=60 für Pilotkunden) – nirgends auf der Seite verlinkt.
  const parsedTrial = Number(trialParam);
  const customTrial = Number.isInteger(parsedTrial) && parsedTrial >= 1 && parsedTrial <= 60 ? parsedTrial : null;
  // Empfehlungslink eines anderen Büros (?ref=CODE): 30 Tage statt 7 (siehe lib/billing/referrals.ts).
  const ref = typeof refParam === "string" && REFERRAL_CODE.test(refParam.toLowerCase()) ? refParam.toLowerCase() : undefined;
  const trialDays = Math.max(customTrial ?? 7, ref ? REFERRAL_TRIAL_DAYS : 7);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Konto erstellen</h1>
      <p className="mb-1 mt-1 text-sm text-muted-foreground">In wenigen Minuten zum ersten Beratungsfall.</p>
      <p className="mb-6 text-sm text-muted-foreground">
        {plan.name}-Plan, {trialDays} Tage kostenlos testen, danach {plan.priceEur} €/Monat. Jederzeit kündbar.
      </p>
      {ref && <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">Sie wurden von einem Kollegen empfohlen – dafür testen Sie {trialDays} Tage kostenlos.</p>}
      <SignupForm plan={plan.id} trialDays={trialDays} referralCode={ref} />
      <p className="mt-4 text-xs text-muted-foreground">
        Hinweise zum Umgang mit Ihren Daten finden Sie in der <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link>.
      </p>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Bereits registriert?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Anmelden
        </Link>
      </p>
    </>
  );
}
