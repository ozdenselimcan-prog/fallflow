import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fetchWebsiteText, suggestBusinessProfile, type SuggestedField } from "@/lib/ai/business-profile";
import { hasUsedTrial, recordTrialUsage } from "@/lib/billing/trial-usage";
import { INDUSTRY_PRESETS } from "@/lib/config/industry-presets";
import { LEGAL_VERSION } from "@/lib/config/legal";
import { siteConfig } from "@/lib/config/site";
import { getPublicStore } from "@/lib/data";
import type { Store } from "@/lib/data/store";
import type { ManagedSetup } from "@/lib/data/types";
import { saveBusinessProfile } from "@/lib/intake/business-profile";
import { applyInterviewAnswer, generateServiceTexts } from "@/lib/intake/interview-answers";
import { sendResendMail } from "@/lib/integrations/resend";
import { createAdminClient } from "@/lib/supabase/clients";

/**
 * Einrichtung über die Website („Wir richten alles für Sie ein“): Ein Betrieb füllt auf /einrichtung den Fragebogen aus.
 * 1. createManagedAccount legt Konto + Betrieb an (noch ohne Passwort, der Betrieb bekommt noch keine Mail).
 * 2. completeManagedSetup richtet mit der KI alles ein (Leistungen, Angaben, Texte je Leistung, Preise, Ton).
 * 3. Der Betreiber prüft im Admin-Bereich (Support-Modus) und schaltet frei: releaseManagedSetup schickt den Zugang,
 *    ab dann läuft die Testphase.
 */

const list = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max).default([]);
export const managedSetupSchema = z.object({
  company: z.string().trim().min(2, "Bitte den Namen Ihres Betriebs angeben").max(120),
  firstName: z.string().trim().min(1, "Bitte Ihren Vornamen angeben").max(60),
  lastName: z.string().trim().min(1, "Bitte Ihren Nachnamen angeben").max(60),
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben").max(200),
  phone: z.string().trim().min(5, "Bitte eine Telefonnummer angeben").max(40),
  address: z.string().trim().max(200).default(""),
  website: z.string().trim().max(200).default(""),
  industry: z.string().trim().max(40).default(""),
  description: z.string().trim().max(1500).default(""),
  services: list(15),
  customers: list(12),
  area: z.string().trim().max(200).default(""),
  strengths: list(12),
  prices: z.array(z.object({ item: z.string().trim().max(80), price: z.string().trim().max(40), note: z.string().trim().max(160).default("") })).max(30).default([]),
  tone: z.enum(["professional", "friendly", "short"]).default("friendly"),
  greeting: z.enum(["guten-tag", "hallo", "sehr-geehrte"]).default("guten-tag"),
  signature: z.string().trim().max(120).default(""),
  note: z.string().trim().max(1000).default(""),
  /** Über die Pilot-Seite aus den Briefen gekommen (nur zur Info im Admin – Testphase wie immer 7 Tage) */
  pilot: z.boolean().default(false),
  terms: z.literal(true, { message: "Bitte stimmen Sie den AGB und der Auftragsverarbeitung zu." }),
  /** Unsichtbares Feld gegen Spam-Bots: Menschen lassen es leer. */
  hp: z.string().max(0).optional(),
});
export type ManagedSetupInput = z.infer<typeof managedSetupSchema>;

/** So lange darf der Support das Konto nach der Anfrage einrichten. */
const SUPPORT_SETUP_DAYS = 14;
const TRIAL_DAYS = 7;

export type CreateResult = { ok: true; companyId: string } | { ok: false; error: "exists" | "unavailable" };

/** Schritt 1: Konto und Betrieb anlegen (ohne Passwort, ohne Mail an den Betrieb). */
export async function createManagedAccount(input: ManagedSetupInput): Promise<CreateResult> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "unavailable" };
  const { data: existing } = await admin.from("company_members").select("user_id").eq("email", input.email).limit(1);
  if (existing?.length) return { ok: false, error: "exists" };

  const now = new Date().toISOString();
  const trialUsedBefore = await hasUsedTrial(input.email).catch(() => false);
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    // Die Adresse gilt erst als bestätigt, wenn der Betrieb den Link aus der Freischaltungs-Mail öffnet; ohne Passwort kann sich
    // bis dahin niemand anmelden. Bestätigt anlegen, damit der Link zum Passwort-Festlegen funktioniert.
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName,
      last_name: input.lastName,
      company: input.company,
      // Zustimmung zu AGB/AVV aus dem Fragebogen mit Zeitpunkt und Fassung (Nachweis).
      terms_accepted_at: now,
      terms_version: LEGAL_VERSION,
      signup_plan: "starter",
      trial_days: TRIAL_DAYS,
      managed_setup: true,
    },
  });
  if (error || !data.user) return { ok: false, error: /already|exists|registered/i.test(error?.message ?? "") ? "exists" : "unavailable" };

  const { data: member } = await admin.from("company_members").select("company_id").eq("user_id", data.user.id).eq("role", "OWNER").maybeSingle();
  const companyId = member?.company_id as string | undefined;
  if (!companyId) return { ok: false, error: "unavailable" };
  const store = await getPublicStore(companyId);
  if (!store) return { ok: false, error: "unavailable" };

  const company = await store.getCompany();
  const managedSetup: ManagedSetup = {
    status: "generating",
    requestedAt: now,
    contactName: `${input.firstName} ${input.lastName}`,
    email: input.email,
    phone: input.phone,
    note: input.note,
    trialDays: TRIAL_DAYS,
    ...(input.pilot ? { pilot: true } : {}),
    answers: { ...input, hp: undefined },
    ...(trialUsedBefore ? { trialUsedBefore: true } : {}),
  };
  await store.updateCompany({
    name: input.company,
    phone: input.phone,
    address: input.address,
    website: input.website,
    businessProfile: {
      ...company.businessProfile,
      managedSetup,
      // Damit der Betreiber das Konto über /admin öffnen und einrichten kann.
      supportAccess: { grantedAt: now, until: new Date(Date.now() + SUPPORT_SETUP_DAYS * 86_400_000).toISOString(), grantedBy: `${input.firstName} ${input.lastName} (Einrichtung über die Website)` },
    },
  });
  return { ok: true, companyId };
}

async function patchSetup(store: Store, patch: Partial<ManagedSetup>): Promise<ManagedSetup | null> {
  const company = await store.getCompany();
  const current = company.businessProfile.managedSetup;
  if (!current) return null;
  const next = { ...current, ...patch };
  await store.updateCompany({ businessProfile: { ...company.businessProfile, managedSetup: next } });
  return next;
}

/** Schritt 2: mit der KI einrichten. Fehler landen als status "failed" im Admin-Bereich (dort erneut startbar). */
export async function completeManagedSetup(companyId: string, input: ManagedSetupInput): Promise<void> {
  const store = await getPublicStore(companyId);
  if (!store) return;
  try {
    const preset = INDUSTRY_PRESETS.find((p) => p.id === input.industry);
    const websiteText = input.website ? await fetchWebsiteText(input.website).catch(() => "") : "";
    const description = [preset ? `Branche: ${preset.title}.` : "", input.description, input.services.length ? `Leistungen: ${input.services.join(", ")}.` : ""].filter(Boolean).join(" ");
    const suggestion = description || websiteText ? await suggestBusinessProfile({ companyName: input.company, description, websiteText }) : null;
    const base = suggestion ?? (preset ? { ...preset, fields: preset.fields as SuggestedField[] } : null);
    if (!base) throw new Error("Kein Vorschlag möglich – bitte Branche und Leistungen im Konto selbst festlegen.");

    // Die Leistungen aus dem Fragebogen gelten; ohne Angabe die vorgeschlagenen.
    const services = input.services.length ? input.services : base.services;
    const fields = base.fields.map((f) => ({ ...f, services: (f.services ?? []).filter((s) => services.includes(s)) }));
    const humanTopics = base.humanTopics.includes("Preise und Kosten") ? base.humanTopics : ["Preise und Kosten", ...base.humanTopics];
    const company = await store.getCompany();
    await saveBusinessProfile(store, {
      ...company.businessProfile,
      industry: base.industry || preset?.industry || "",
      description: input.description || base.description,
      documents: base.documents,
      documentsByService: base.documentsByService,
      humanTopics,
      needsAddress: base.needsAddress ?? true,
      services,
      fields,
    });

    if (input.customers.length) await applyInterviewAnswer(store, { step: "customers", values: input.customers });
    if (input.area) await applyInterviewAnswer(store, { step: "area", value: input.area });
    if (input.strengths.length) await applyInterviewAnswer(store, { step: "strengths", values: input.strengths });
    const prices = input.prices.filter((p) => p.item && p.price);
    if (prices.length) await applyInterviewAnswer(store, { step: "prices", prices });
    await applyInterviewAnswer(store, { step: "tone", tone: input.tone, greeting: input.greeting, signature: input.signature });

    const texts = await generateServiceTexts(store);
    await patchSetup(store, { status: "ready", error: texts ? undefined : "Texte je Leistung konnten nicht erstellt werden – bitte im Konto unter Vorlagen & Nachrichten prüfen." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unbekannt";
    console.error("[managed-setup] Einrichtung fehlgeschlagen:", message);
    await patchSetup(store, { status: "failed", error: message.slice(0, 300) });
  }
  await notifyOperator(store).catch((err) => console.error("[managed-setup] Benachrichtigung fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt"));
}

async function notifyOperator(store: Store): Promise<void> {
  const company = await store.getCompany();
  const s = company.businessProfile.managedSetup;
  if (!s) return;
  const text = [
    s.status === "ready" ? "Ein Betrieb hat sich über den Fragebogen auf der Website angemeldet – das Konto ist eingerichtet und wartet auf deine Prüfung." : "Ein Betrieb hat sich über den Fragebogen angemeldet, die automatische Einrichtung ist aber fehlgeschlagen.",
    "",
    `Betrieb: ${company.name}`,
    `Ansprechpartner: ${s.contactName}`,
    `Telefon: ${s.phone}`,
    `E-Mail: ${s.email}`,
    s.note ? `Nachricht: ${s.note}` : "",
    s.pilot ? "Pilotbetrieb (über den Brief / QR-Code)" : "",
    s.error ? `Hinweis: ${s.error}` : "",
    "",
    `Prüfen und freischalten: ${siteConfig.appUrl}/admin`,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  await sendResendMail({ fromName: "FallFlow Einrichtung", to: siteConfig.supportEmail, replyTo: [s.email], subject: `Neue Einrichtung: ${company.name}`, text });
}

// ---------- Freischaltung ----------

const ACCESS_DAYS = 14;
const secret = () => process.env.CONNECTIONS_SECRET || process.env.CRON_SECRET || "";
const sign = (payload: string) => createHmac("sha256", secret()).update(`setup:${payload}`).digest("base64url");

/** Link aus der Freischaltungs-Mail: "<companyId>.<ablauf ms>.<signatur>" – 14 Tage gültig. */
export function accessToken(companyId: string, now = Date.now()): string {
  const payload = `${companyId}.${now + ACCESS_DAYS * 86_400_000}`;
  return `${payload}.${sign(payload)}`;
}

export function readAccessToken(token: string, now = Date.now()): string | null {
  if (!secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [companyId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${companyId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) < now) return null;
  return companyId;
}

/** Gespeicherte Antworten erneut einrichten lassen (Admin: „Erneut einrichten“). */
export async function retryManagedSetup(companyId: string): Promise<boolean> {
  const store = await getPublicStore(companyId);
  const answers = store ? (await store.getCompany()).businessProfile.managedSetup?.answers : undefined;
  const parsed = managedSetupSchema.safeParse({ ...answers, terms: true });
  if (!store || !parsed.success) return false;
  await patchSetup(store, { status: "generating", error: undefined });
  await completeManagedSetup(companyId, parsed.data);
  return true;
}

/** Schritt 3: Testphase starten und dem Betrieb den Zugang schicken. */
export async function releaseManagedSetup(companyId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const store = await getPublicStore(companyId);
  if (!admin || !store) return { ok: false, error: "Nicht verfügbar." };
  const company = await store.getCompany();
  const s = company.businessProfile.managedSetup;
  if (!s) return { ok: false, error: "Kein über die Website angelegtes Konto." };
  if (s.status === "generating") return { ok: false, error: "Die Einrichtung läuft noch – bitte kurz warten." };

  // Testphase ab jetzt (nicht ab dem Fragebogen); mit schon genutzter Testphase gleich zur Bezahlung.
  const trialDays = s.trialDays ?? TRIAL_DAYS;
  const end = new Date(Date.now() + (s.trialUsedBefore ? 0 : trialDays) * 86_400_000).toISOString();
  await admin.from("subscriptions").update({ current_period_end: end }).eq("company_id", companyId).is("stripe_customer_id", null);
  if (!s.trialUsedBefore) await recordTrialUsage(s.email).catch(() => {});

  const link = `${siteConfig.appUrl}/einrichtung/zugang/${accessToken(companyId)}`;
  const text = [
    `Guten Tag ${s.contactName},`,
    "",
    `Ihr FallFlow für ${company.name} ist eingerichtet: Ihre Leistungen, die Angaben, nach denen gefragt wird, und die Texte für Ihre Antworten sind fertig.`,
    "",
    "So geht es weiter:",
    `1. Passwort festlegen: ${link}`,
    "2. Ihr E-Mail-Postfach verbinden (dauert etwa 2 Minuten) – ab dann beantwortet FallFlow neue Anfragen automatisch.",
    "",
    `Sie können ${s.trialUsedBefore ? "FallFlow direkt nutzen" : `FallFlow ${trialDays} Tage kostenlos testen`}. Alle Texte und Einstellungen können Sie jederzeit selbst ändern.`,
    "",
    "Lieber gemeinsam? Antworten Sie einfach auf diese E-Mail oder rufen Sie an – dann verbinden wir das Postfach zusammen am Telefon.",
    "",
    "Viele Grüße",
    "Selimcan Özden",
    "FallFlow",
  ].join("\n");
  await sendResendMail({ fromName: "FallFlow", to: s.email, replyTo: [siteConfig.supportEmail], subject: `Ihr FallFlow ist eingerichtet – ${company.name}`, text });

  await store.updateCompany({ onboardingCompleted: true, businessProfile: { ...company.businessProfile, managedSetup: { ...s, status: "released", releasedAt: new Date().toISOString() } } });
  return { ok: true };
}

/**
 * Link aus der Freischaltungs-Mail einlösen: frischer Link zum Passwort-Festlegen (Supabase), solange sich der Betrieb noch
 * nie angemeldet hat. Danach führt der Link nur noch zur Anmeldung.
 */
export async function passwordLinkFor(token: string): Promise<string | null> {
  const companyId = readAccessToken(token);
  const admin = createAdminClient();
  if (!companyId || !admin) return null;
  const { data: member } = await admin.from("company_members").select("user_id, email").eq("company_id", companyId).eq("role", "OWNER").maybeSingle();
  if (!member?.user_id) return null;
  const { data: user } = await admin.auth.admin.getUserById(member.user_id as string);
  if (!user.user || user.user.last_sign_in_at) return null;
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: member.email as string });
  const hash = data?.properties?.hashed_token;
  if (error || !hash) return null;
  return `${siteConfig.appUrl}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=recovery&next=/reset-password`;
}

/** Für den Admin-Bereich: alle über die Website angelegten Konten. */
export interface ManagedSetupRow {
  companyId: string;
  company: string;
  setup: ManagedSetup;
  supportUntil: string | null;
}

export async function loadManagedSetups(now = Date.now()): Promise<ManagedSetupRow[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.from("companies").select("id, name, business_profile").not("business_profile->managedSetup", "is", null).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => {
    const bp = c.business_profile as { managedSetup: ManagedSetup; supportAccess?: { until?: string } };
    const until = bp.supportAccess?.until;
    return { companyId: c.id as string, company: c.name as string, setup: bp.managedSetup, supportUntil: until && Date.parse(until) > now ? until : null };
  });
}
