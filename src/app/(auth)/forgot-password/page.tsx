import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Passwort zurücksetzen" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Passwort vergessen?</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Wir senden Ihnen einen Link zum Zurücksetzen.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Zurück zum Login
        </Link>
      </p>
    </>
  );
}
