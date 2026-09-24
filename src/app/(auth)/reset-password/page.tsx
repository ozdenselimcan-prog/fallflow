import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Neues Passwort" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Neues Passwort festlegen</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Wählen Sie ein neues Passwort für Ihr Konto.</p>
      <ResetForm />
    </>
  );
}
