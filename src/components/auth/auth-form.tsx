"use client";
import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import type { ActionResult } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { forgotSchema, loginSchema, signupSchema } from "@/lib/validation";
import { forgotPasswordAction, loginAction, resetPasswordAction, signupAction } from "@/app/(auth)/actions";


type Values = Record<string, string>;

interface FieldDef {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
}

function AuthForm({ schema, fields, action, submitLabel, footer }: { schema: z.ZodType<Values>; fields: FieldDef[]; action: (v: Values) => Promise<ActionResult>; submitLabel: string; footer?: React.ReactNode }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema as never) });
  const [result, setResult] = useState<ActionResult>({});
  const [pending, start] = useTransition();

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((values) =>
        start(async () => {
          setResult({});
          // redirect() im Server Action beendet den Aufruf mit einer Navigation; nur Fehler/Hinweise kommen zurück.
          const res = await action(values);
          if (res) setResult(res);
        }),
      )}
    >
      {fields.map((f) => (
        <Field key={f.name} label={f.label} error={errors[f.name]?.message as string | undefined}>
          <Input type={f.type ?? "text"} autoComplete={f.autoComplete} {...register(f.name)} />
        </Field>
      ))}
      {result.error && <Notice tone="error">{result.error}</Notice>}
      {result.message && <Notice tone="success">{result.message}</Notice>}
      <Button type="submit" className="w-full" loading={pending}>
        {submitLabel}
      </Button>
      {footer}
    </form>
  );
}

export function LoginForm() {
  return (
    <AuthForm
      schema={loginSchema}
      action={loginAction}
      submitLabel="Anmelden"
      fields={[
        { name: "email", label: "E-Mail", type: "email", autoComplete: "email" },
        { name: "password", label: "Passwort", type: "password", autoComplete: "current-password" },
      ]}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="hover:text-foreground">
            Passwort vergessen?
          </Link>
        </p>
      }
    />
  );
}

export function SignupForm() {
  return (
    <AuthForm
      schema={signupSchema}
      action={signupAction}
      submitLabel="Konto erstellen"
      fields={[
        { name: "firstName", label: "Vorname", autoComplete: "given-name" },
        { name: "lastName", label: "Nachname", autoComplete: "family-name" },
        { name: "company", label: "Unternehmen", autoComplete: "organization" },
        { name: "email", label: "E-Mail", type: "email", autoComplete: "email" },
        { name: "password", label: "Passwort (mind. 8 Zeichen)", type: "password", autoComplete: "new-password" },
      ]}
    />
  );
}

export function ForgotForm() {
  return <AuthForm schema={forgotSchema} action={forgotPasswordAction} submitLabel="Link anfordern" fields={[{ name: "email", label: "E-Mail", type: "email", autoComplete: "email" }]} />;
}

export function ResetForm() {
  const wrapped = (v: Values) => resetPasswordAction(v.password);
  return (
    <AuthForm
      schema={signupSchema.pick({ password: true }) as unknown as z.ZodType<Values>}
      action={wrapped}
      submitLabel="Passwort speichern"
      fields={[{ name: "password", label: "Neues Passwort (mind. 8 Zeichen)", type: "password", autoComplete: "new-password" }]}
    />
  );
}
