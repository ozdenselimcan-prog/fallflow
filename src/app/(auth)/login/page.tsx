import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Willkommen zurück bei FallFlow.</p>
      {error === "callback" && (
        <p role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          Der Bestätigungslink ist ungültig oder abgelaufen. Bitte melden Sie sich an oder fordern Sie einen neuen Link an.
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Noch kein Konto?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Kostenlos testen
        </Link>
      </p>
    </>
  );
}
