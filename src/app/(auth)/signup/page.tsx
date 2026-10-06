import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/auth-form";
import { plans } from "@/lib/config/pricing";

export const metadata: Metadata = { title: "Registrieren" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { plan: planParam, trial: trialParam } = await searchParams;
  const plan = plans.find((p) => p.id === planParam) ?? plans[0];
  // Standard 7 Tage; ein individueller Testzeitraum (z. B. 14 Tage für einen einzelnen Kunden) läuft nur
  // über einen gezielt verschickten Link mit ?trial=14 – nirgends auf der Seite verlinkt.
  const parsedTrial = Number(trialParam);
  const trialDays = Number.isInteger(parsedTrial) && parsedTrial >= 1 && parsedTrial <= 30 ? parsedTrial : 7;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Konto erstellen</h1>
      <p className="mb-1 mt-1 text-sm text-muted-foreground">In wenigen Minuten zum ersten Beratungsfall.</p>
      <p className="mb-6 text-sm text-muted-foreground">
        {plan.name}-Plan, {trialDays} Tage kostenlos testen, danach {plan.priceEur} €/Monat. Jederzeit kündbar.
      </p>
      <SignupForm plan={plan.id} trialDays={trialDays} />
      <p className="mt-4 text-xs text-muted-foreground">
        Mit der Registrierung nehmen Sie die <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link> zur Kenntnis.
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
