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


type Values = Record<string, string | boolean>;

interface FieldDef {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  /** Bei type "checkbox": Beschriftung mit Links (z. B. AGB/AVV). */
  labelNode?: React.ReactNode;
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
          // redirect() im Server Action beendet den Aufruf mit einer Navigation; nur Fehler/Hinweise/externe Ziele kommen zurück.
          const res = await action(values);
          if (res.redirectTo) {
            window.location.href = res.redirectTo;
            return;
          }
          if (res) setResult(res);
        }),
      )}
    >
      {fields.map((f) =>
        f.type === "checkbox" ? (
          <div key={f.name}>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" aria-label={f.label} {...register(f.name)} />
              <span className="text-muted-foreground">{f.labelNode ?? f.label}</span>
            </label>
            {errors[f.name]?.message && <p className="mt-1 text-sm text-danger">{errors[f.name]?.message as string}</p>}
          </div>
        ) : (
          <Field key={f.name} label={f.label} error={errors[f.name]?.message as string | undefined}>
            <Input type={f.type ?? "text"} autoComplete={f.autoComplete} {...register(f.name)} />
          </Field>
        ),
      )}
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

export function SignupForm({ plan, trialDays, referralCode, buy }: { plan?: string; trialDays?: number; referralCode?: string; buy?: boolean }) {
  return (
    <AuthForm
      schema={signupSchema}
      action={(v) => signupAction({ ...v, plan, trialDays, referralCode, buy })}
      submitLabel="Konto erstellen"
      fields={[
        { name: "firstName", label: "Vorname", autoComplete: "given-name" },
        { name: "lastName", label: "Nachname", autoComplete: "family-name" },
        { name: "company", label: "Unternehmen", autoComplete: "organization" },
        { name: "email", label: "E-Mail", type: "email", autoComplete: "email" },
        { name: "password", label: "Passwort (mind. 8 Zeichen)", type: "password", autoComplete: "new-password" },
        {
          name: "acceptTerms",
          label: "AGB und AVV akzeptieren",
          type: "checkbox",
          labelNode: (
            <>
              Ich handle als Unternehmer und akzeptiere die{" "}
              <Link href="/agb" target="_blank" className="font-medium text-foreground underline">
                AGB
              </Link>{" "}
              und den{" "}
              <Link href="/avv" target="_blank" className="font-medium text-foreground underline">
                Auftragsverarbeitungsvertrag (AVV)
              </Link>
              .
            </>
          ),
        },
      ]}
    />
  );
}

export function ForgotForm() {
  return <AuthForm schema={forgotSchema} action={forgotPasswordAction} submitLabel="Link anfordern" fields={[{ name: "email", label: "E-Mail", type: "email", autoComplete: "email" }]} />;
}

export function ResetForm() {
  const wrapped = (v: Values) => resetPasswordAction(String(v.password));
  return (
    <AuthForm
      schema={signupSchema.pick({ password: true }) as unknown as z.ZodType<Values>}
      action={wrapped}
      submitLabel="Passwort speichern"
      fields={[{ name: "password", label: "Neues Passwort (mind. 8 Zeichen)", type: "password", autoComplete: "new-password" }]}
    />
  );
}
