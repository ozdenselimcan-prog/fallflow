import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Registrieren" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Konto erstellen</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">In wenigen Minuten zum ersten Beratungsfall.</p>
      <SignupForm />
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
