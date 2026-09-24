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
});

export const forgotSchema = z.object({ email: z.string().trim().email("Bitte gültige E-Mail eingeben") });

/** Fall-ID: UUID oder Demo-Seed-ID (c-N) */
export const caseIdSchema = z.string().uuid().or(z.string().regex(/^c-\d+$/));

export const caseFieldsSchema = z.record(z.string().min(1).max(60), z.string().max(1000));

export const caseCreateSchema = z.object({
  fields: caseFieldsSchema,
  source: z.enum(["manual", "email", "whatsapp", "widget", "phone"]).default("manual"),
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

export const assistantSchema = z.object({
  name: str(40).min(1, "Name erforderlich"),
  greeting: str(300).min(1, "Begrüßung erforderlich"),
  tone: z.enum(TONES),
  autoReply: z.boolean(),
  autoFollowUp: z.boolean(),
  appointmentBooking: z.boolean(),
  humanHandoff: z.boolean(),
});

export const companySchema = z.object({
  name: str(120).min(1, "Firmenname erforderlich"),
  website: str(200).default(""),
  phone: str(40).default(""),
  address: str(300).default(""),
});

export const onboardingSchema = companySchema.extend({
  services: z.array(str(60)).max(20),
  activeFieldKeys: z.array(str(40)).max(50),
});

export const profileSchema = z.object({ firstName: str(60).min(1, "Vorname erforderlich"), lastName: str(60).min(1, "Nachname erforderlich") });

export const inviteSchema = z.object({ email: z.string().trim().email("Bitte gültige E-Mail eingeben"), role: z.enum(ROLES).exclude(["OWNER"]) });
export const roleSchema = z.object({ id: z.string(), role: z.enum(ROLES).exclude(["OWNER"]) });

/** phone_note = interne Telefonnotiz; email/whatsapp = Nachricht an den Kunden über den jeweiligen Kanal */
export const messageSchema = z.object({
  caseId: z.string().min(1).max(64),
  content: str(2000).min(1),
  kind: z.enum(["phone_note", "email", "whatsapp"]).default("phone_note"),
});

export const documentRequestSchema = z.object({ kinds: z.array(z.enum(DOCUMENT_KINDS)).max(4).optional() });

export const followUpActionSchema = z.object({ action: z.enum(["cancel", "mark_sent", "plan"]) });

export const simulateInboundSchema = z.object({
  channel: z.enum(["whatsapp", "email"]),
  /** Telefonnummer (WhatsApp) bzw. E-Mail-Adresse (E-Mail) des simulierten Absenders */
  sender: str(120).min(3, "Absender erforderlich"),
  name: str(100).optional(),
  text: str(1500).min(1, "Nachricht erforderlich"),
});

export const widgetSessionSchema = z.object({ companyId: z.string().uuid().or(z.literal("demo")) });
export const widgetMessageSchema = z.object({
  companyId: z.string().uuid().or(z.literal("demo")),
  sessionId: z.string().uuid().nullable(),
  text: str(1500).min(1),
});

export const aiChatSchema = z.object({
  fields: caseFieldsSchema.default({}),
  text: str(1500).min(1),
  first: z.boolean().default(false),
});
export const extractSchema = z.object({ text: str(2000).min(1) });
