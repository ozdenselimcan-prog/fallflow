import { z } from "zod";
import { CASE_STATUSES, DOCUMENT_KINDS, QUESTION_TYPES, ROLES, TONES } from "@/lib/data/types";

const str = (max: number) => z.string().trim().max(max);

export const passwordSchema = z.string().min(8, "Mindestens 8 Zeichen").max(72);

export const loginSchema = z.object({
  email: z.string().trim().email("Bitte gültige E-Mail eingeben"),
  password: z.string().min(1, "Passwort erforderlich").max(72),
});

export const signupSchema = z.object({
  firstName: str(60).min(1, "Vorname erforderlich"),
  lastName: str(60).min(1, "Nachname erforderlich"),
  email: z.string().trim().email("Bitte gültige E-Mail eingeben"),
  password: passwordSchema,
  company: str(120).min(1, "Unternehmen erforderlich"),
  plan: z.enum(["starter", "pro", "business"]).optional(),
});

export const forgotSchema = z.object({ email: z.string().trim().email("Bitte gültige E-Mail eingeben") });

/** Fall-ID: UUID oder Demo-Seed-ID (c-N) */
export const caseIdSchema = z.string().uuid().or(z.string().regex(/^c-\d+$/));

export const caseFieldsSchema = z.record(z.string().min(1).max(60), z.string().max(1000));

export const caseCreateSchema = z.object({
  fields: caseFieldsSchema,
  source: z.enum(["manual", "email", "widget", "phone"]).default("manual"),
});

export const casePatchSchema = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  fields: caseFieldsSchema.optional(),
  /** true = dem aktuellen Benutzer zuweisen und auf "Übernommen" setzen */
  assign: z.boolean().optional(),
});

export const caseQuerySchema = z.object({
  q: z.string().max(100).optional(),
  status: z.enum(CASE_STATUSES).optional(),
  service: z.string().max(60).optional(),
  minCompleteness: z.coerce.number().min(0).max(100).optional(),
  from: z.string().max(40).optional(),
  sort: z.enum(["newest", "oldest", "completeness", "name"]).optional(),
});

export const appointmentSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  caseId: z.string().min(1).max(64).nullable().default(null),
  title: str(160).min(1, "Titel erforderlich"),
  startsAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Ungültiges Datum").transform((v) => new Date(v).toISOString()),
  durationMin: z.coerce.number().int().min(5).max(1440).default(60),
  notes: str(1000).default(""),
  status: z.enum(["proposed", "confirmed"]).optional(),
});

export const questionSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]{1,39}$/, "Schlüssel: Buchstaben/Zahlen, 2–40 Zeichen"),
  label: str(80).min(1, "Bezeichnung erforderlich"),
  prompt: str(300).min(1, "Fragetext erforderlich"),
  type: z.enum(QUESTION_TYPES),
  options: z.array(str(80).min(1)).max(20).default([]),
  required: z.boolean(),
  active: z.boolean(),
});

export const reorderSchema = z.object({ ids: z.array(z.string()).max(100) });

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format JJJJ-MM-TT");

export const assistantSchema = z
  .object({
    name: str(40).min(1, "Name erforderlich"),
    greeting: str(300).min(1, "Begrüßung erforderlich"),
    tone: z.enum(TONES),
    autoReply: z.boolean(),
    autoFollowUp: z.boolean(),
    appointmentBooking: z.boolean(),
    humanHandoff: z.boolean(),
    workingDays: z.array(z.number().int().min(0).max(6)).max(7),
    slotStart: timeSchema,
    slotEnd: timeSchema,
    slotMinutes: z.coerce.number().int().min(15).max(480),
    maxAppointmentsPerDay: z.coerce.number().int().min(1).max(50).nullable(),
    vacationFrom: dateSchema.nullable(),
    vacationUntil: dateSchema.nullable(),
    appointmentConfirmedTemplate: str(500),
  })
  .refine((v) => v.slotStart < v.slotEnd, { message: "Beginn muss vor dem Ende liegen", path: ["slotEnd"] })
  .refine((v) => !v.vacationFrom || !v.vacationUntil || v.vacationFrom <= v.vacationUntil, { message: "Enddatum darf nicht vor dem Startdatum liegen", path: ["vacationUntil"] });

export const companySchema = z.object({
  name: str(120).min(1, "Firmenname erforderlich"),
  website: str(200).default(""),
  phone: str(40).default(""),
  address: str(300).default(""),
  services: z.array(str(60)).max(20).optional(),
  foerderEnergyCertificate: z.boolean().optional(),
  foerderFloorplan: z.boolean().optional(),
  contactFormUrl: z.union([str(300).url("Bitte eine gültige URL eingeben"), str(0)]).optional(),
});

/** Verfügbarkeit für Terminvorschläge – im Onboarding und später in den Assistent-Einstellungen gepflegt. */
export const availabilitySchema = z
  .object({
    workingDays: z.array(z.number().int().min(0).max(6)).max(7),
    slotStart: timeSchema,
    slotEnd: timeSchema,
    slotMinutes: z.coerce.number().int().min(15).max(480),
    maxAppointmentsPerDay: z.coerce.number().int().min(1).max(50).nullable(),
  })
  .refine((v) => v.slotStart < v.slotEnd, { message: "Beginn muss vor dem Ende liegen", path: ["slotEnd"] });

export const onboardingSchema = companySchema.extend({
  services: z.array(str(60)).max(20),
  activeFieldKeys: z.array(str(40)).max(50),
  availability: availabilitySchema,
});

export const profileSchema = z.object({ firstName: str(60).min(1, "Vorname erforderlich"), lastName: str(60).min(1, "Nachname erforderlich") });

export const checkoutSchema = z.object({ plan: z.enum(["starter", "pro", "business"]) });

export const inviteSchema = z.object({ email: z.string().trim().email("Bitte gültige E-Mail eingeben"), role: z.enum(ROLES).exclude(["OWNER"]) });
export const roleSchema = z.object({ id: z.string(), role: z.enum(ROLES).exclude(["OWNER"]) });

/** phone_note = interne Telefonnotiz; email = Nachricht an den Kunden per E-Mail */
export const messageSchema = z.object({
  caseId: z.string().min(1).max(64),
  content: str(2000).min(1),
  kind: z.enum(["phone_note", "email"]).default("phone_note"),
  /** Nur bei kind "email": eigener Betreff statt des Standardtexts. */
  subject: str(200).optional(),
});

export const documentRequestSchema = z.object({ kinds: z.array(z.enum(DOCUMENT_KINDS)).max(4).optional() });

export const followUpActionSchema = z.object({ action: z.enum(["cancel", "mark_sent", "plan"]) });

export const widgetSessionSchema = z.object({ companyId: z.string().uuid().or(z.literal("demo")) });
export const widgetMessageSchema = z.object({
  companyId: z.string().uuid().or(z.literal("demo")),
  sessionId: z.string().uuid().nullable(),
  text: str(1500).min(1),
  /** true = Seite läuft in einem iframe (echte Einbindung via widget.js), nicht direkt aufgerufen. */
  embedded: z.boolean().optional(),
});

export const aiChatSchema = z.object({
  fields: caseFieldsSchema.default({}),
  text: str(1500).min(1),
  first: z.boolean().default(false),
});
export const extractSchema = z.object({ text: str(2000).min(1) });
