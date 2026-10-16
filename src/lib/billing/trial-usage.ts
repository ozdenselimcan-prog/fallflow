import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/clients";

/** So lange merkt sich FallFlow, dass eine E-Mail-Adresse schon getestet hat (siehe Datenschutzerklärung). */
const KEEP_DAYS = 3 * 365;

/**
 * Gleiche Adresse in anderer Schreibweise zählt als dieselbe: Groß-/Kleinschreibung, "+zusatz" und bei Gmail die Punkte
 * im Namen (max.muster@gmail.com = maxmuster+test@googlemail.com).
 */
export function normalizeTrialEmail(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  let local = rawLocal.split("+")[0];
  let domain = rawDomain;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replaceAll(".", "");
  return `${local}@${domain}`;
}

export function trialEmailHash(email: string): string {
  return createHash("sha256").update(normalizeTrialEmail(email)).digest("hex");
}

/** Hat diese E-Mail-Adresse die kostenlose Testphase schon einmal genutzt? Im Zweifel (Fehler) nein. */
export async function hasUsedTrial(email: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.from("trial_usage").select("email_hash").eq("email_hash", trialEmailHash(email)).maybeSingle();
  if (error) console.error("[trial-usage] Abfrage fehlgeschlagen:", error.message);
  return Boolean(data);
}

/** Merkt sich, dass diese E-Mail-Adresse jetzt eine Testphase bekommt. */
export async function recordTrialUsage(email: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.from("trial_usage").upsert({ email_hash: trialEmailHash(email) }, { onConflict: "email_hash", ignoreDuplicates: true });
  if (error) console.error("[trial-usage] Speichern fehlgeschlagen:", error.message);
}

/** Alte Einträge löschen (täglicher Cron). */
export async function purgeOldTrialUsage(now = Date.now()): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.from("trial_usage").delete().lt("created_at", new Date(now - KEEP_DAYS * 86_400_000).toISOString());
  if (error) console.error("[trial-usage] Aufräumen fehlgeschlagen:", error.message);
}
