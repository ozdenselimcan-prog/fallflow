import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/auth-form";
import { REFERRAL_CODE, REFERRAL_TRIAL_DAYS } from "@/lib/billing/referrals";
import { plans } from "@/lib/config/pricing";

export const metadata: Metadata = { title: "Registrieren" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { plan: planParam, trial: trialParam, ref: refParam, buy: buyParam } = await searchParams;
  // "Direkt kaufen" auf der Preisseite: ohne Testphase, nach der Registrierung direkt zur Bezahlung.
  const buy = buyParam === "1";
  const plan = plans.find((p) => p.id === planParam) ?? plans[0];
  // Standard 7 Tage; ein individueller Testzeitraum (z. B. 14 Tage für einen einzelnen Kunden) läuft nur
  // über einen gezielt verschickten Link mit ?trial=14 (bis 60, z. B. ?trial=60 für Pilotkunden) – nirgends auf der Seite verlinkt.
  const parsedTrial = Number(trialParam);
  const customTrial = Number.isInteger(parsedTrial) && parsedTrial >= 1 && parsedTrial <= 60 ? parsedTrial : null;
  // Empfehlungslink eines anderen Büros (?ref=CODE): 14 Tage statt 7 (siehe lib/billing/referrals.ts).
  const ref = typeof refParam === "string" && REFERRAL_CODE.test(refParam.toLowerCase()) ? refParam.toLowerCase() : undefined;
  const trialDays = Math.max(customTrial ?? 7, ref ? REFERRAL_TRIAL_DAYS : 7);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Konto erstellen</h1>
      <p className="mb-1 mt-1 text-sm text-muted-foreground">In wenigen Minuten zum ersten Beratungsfall.</p>
      <p className="mb-6 text-sm text-muted-foreground">
        {buy ? (
          <>
            {plan.name}-Plan für {plan.priceEur} €/Monat, monatlich kündbar. Nach der Registrierung geht es direkt zur Bezahlung.{" "}
            <Link href={`/signup?plan=${plan.id}`} className="underline">
              Lieber erst kostenlos testen?
            </Link>
          </>
        ) : (
          <>
            {plan.name}-Plan, {trialDays} Tage kostenlos testen – ohne Kreditkarte. Danach {plan.priceEur} €/Monat, jederzeit kündbar.
          </>
        )}
      </p>
      {ref && !buy && <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">Sie wurden von einem Kollegen empfohlen – dafür testen Sie {trialDays} Tage kostenlos.</p>}
      <SignupForm plan={plan.id} trialDays={trialDays} referralCode={ref} buy={buy} />
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
