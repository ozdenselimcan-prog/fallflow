import { after } from "next/server";
import { apiError, json, parseBody, publicRoute } from "@/lib/api";
import { siteConfig } from "@/lib/config/site";
import { completeManagedSetup, createManagedAccount, managedSetupSchema } from "@/lib/setup/managed";

// Die KI-Einrichtung läuft nach der Antwort weiter (Vorschlag, Texte je Leistung) – das kann etwas dauern.
export const maxDuration = 300;

/** Fragebogen auf /einrichtung: Konto anlegen und im Hintergrund einrichten (siehe lib/setup/managed.ts). */
export const POST = publicRoute("managed-setup", 3, async (req) => {
  const body = await parseBody(req, managedSetupSchema);
  if (!body.ok) return body.res;
  const result = await createManagedAccount(body.data);
  if (!result.ok) {
    if (result.error === "exists") return apiError("Für diese E-Mail-Adresse gibt es schon ein FallFlow-Konto. Bitte melden Sie sich an – oder rufen Sie uns an, dann helfen wir Ihnen weiter.", 409);
    return apiError(`Das hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal oder schreiben Sie uns an ${siteConfig.supportEmail}.`, 503);
  }
  after(() => completeManagedSetup(result.companyId, body.data));
  return json({ ok: true });
});
