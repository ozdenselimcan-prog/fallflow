import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { cookies } from "next/headers";
import { SignupForm } from "@/components/auth/auth-form";
import { REFERRAL_COOKIE } from "@/lib/billing/referral-code";
import { REFERRAL_CODE, REFERRAL_TRIAL_DAYS } from "@/lib/billing/referrals";
import { plans } from "@/lib/config/pricing";

export const metadata: Metadata = { title: "Registrieren" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { plan: planParam, trial: trialParam, ref: refParam, buy: buyParam } = await searchParams;
  // "Direkt kaufen" auf der Preisseite: ohne Testphase, nach der Registrierung direkt zur Bezahlung.
  const plan = plans.find((p) => p.id === planParam) ?? plans[0];
  // Testphase nur mit Starter – Pro und Business werden direkt abonniert.
  const buy = buyParam === "1" || !plan.trial;
  // Standard 7 Tage; ein individueller Testzeitraum (z. B. 14 Tage für einen einzelnen Kunden) läuft nur
  // über einen gezielt verschickten Link mit ?trial=14 (bis 60, z. B. ?trial=60 für Pilotkunden) – nirgends auf der Seite verlinkt.
  const parsedTrial = Number(trialParam);
  const customTrial = Number.isInteger(parsedTrial) && parsedTrial >= 1 && parsedTrial <= 60 ? parsedTrial : null;
  // Empfehlungslink eines anderen Büros (?ref=CODE): 14 Tage statt 7 (siehe lib/billing/referrals.ts).
  // Ohne Link in der Adresse: der beim Öffnen des Empfehlungslinks gemerkte Code (Cookie, siehe proxy.ts).
  const rawRef = typeof refParam === "string" ? refParam : (await cookies()).get(REFERRAL_COOKIE)?.value;
  const ref = rawRef && REFERRAL_CODE.test(rawRef.toLowerCase()) ? rawRef.toLowerCase() : undefined;
  const trialDays = Math.max(customTrial ?? 7, ref ? REFERRAL_TRIAL_DAYS : 7);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{buy ? "Konto erstellen" : `${trialDays} Tage kostenlos testen`}</h1>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        {buy ? (
          <>
            {plan.name}-Plan für {plan.priceEur} €/Monat. Nach der Registrierung geht es direkt zur Bezahlung.{" "}
            <Link href="/signup?plan=starter" className="underline">
              {plan.trial ? "Lieber erst kostenlos testen?" : "Lieber erst 7 Tage kostenlos mit Starter testen?"}
            </Link>
          </>
        ) : (
          <>In wenigen Minuten zur ersten automatisch bearbeiteten Anfrage.</>
        )}
      </p>
      <ul className="mb-5 mt-3 flex flex-wrap gap-1.5 text-xs font-medium sm:mb-8 sm:mt-4 sm:gap-2">
        {(buy ? [`${plan.name}-Plan`, "Monatlich kündbar", "Server in der EU"] : ["Ohne Kreditkarte", `Danach ${plan.priceEur} €/Monat (${plan.name})`, "Jederzeit kündbar"]).map((t) => (
          <li key={t} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 sm:px-3 sm:py-1.5">
            <Check className="size-3.5" aria-hidden /> {t}
          </li>
        ))}
      </ul>
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
