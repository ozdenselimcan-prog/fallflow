import type { AssistantSettings, Question } from "@/lib/data/types";

export const SERVICES = [
  "Energieberatung",
  "iSFP",
  "Energieausweis",
  "Fördermittelberatung",
  "Baubegleitung",
  "Heizung",
  "Sanierung",
  "Sonstiges",
] as const;

export const BUILDING_TYPES = ["Einfamilienhaus", "Mehrfamilienhaus", "Sonstiges"] as const;
export const HEATING_TYPES = ["Gas", "Öl", "Wärmepumpe", "Fernwärme", "Holz/Pellets", "Strom", "Sonstiges"] as const;

/** Feldgruppen der Fall-Detailansicht. */
export const FIELD_GROUPS: { title: string; fields: { key: string; label: string }[] }[] = [
  {
    title: "Kontakt",
    fields: [
      { key: "name", label: "Name" },
      { key: "email", label: "E-Mail" },
      { key: "phone", label: "Telefon" },
    ],
  },
  {
    title: "Gebäude",
    fields: [
      { key: "buildingType", label: "Gebäudeart" },
      { key: "yearBuilt", label: "Baujahr" },
      { key: "livingArea", label: "Wohnfläche (m²)" },
      { key: "postalCode", label: "PLZ" },
    ],
  },
  {
    title: "Technik",
    fields: [
      { key: "heating", label: "Heizung" },
      { key: "condition", label: "Zustand" },
      { key: "energySource", label: "Energiequelle" },
    ],
  },
  {
    title: "Anliegen",
    fields: [
      { key: "service", label: "Gewünschte Leistung" },
      { key: "description", label: "Beschreibung" },
    ],
  },
];

type QuestionSeed = Omit<Question, "id" | "companyId" | "position">;

/** Standardfragen, die jedes neue Büro erhält (Reihenfolge = Abfragereihenfolge). */
export const DEFAULT_QUESTIONS: QuestionSeed[] = [
  { key: "service", label: "Anliegen", prompt: "Welche Leistung möchten Sie anfragen?", type: "choice", options: [...SERVICES], required: true, active: true },
  { key: "buildingType", label: "Gebäudeart", prompt: "Welche Art Gebäude möchten Sie sanieren?", type: "choice", options: [...BUILDING_TYPES], required: true, active: true },
  { key: "yearBuilt", label: "Baujahr", prompt: "Was ist das Baujahr des Gebäudes?", type: "number", options: [], required: true, active: true },
  { key: "livingArea", label: "Wohnfläche", prompt: "Wie groß ist die Wohnfläche in m²?", type: "number", options: [], required: true, active: true },
  { key: "heating", label: "Heizung", prompt: "Welche Heizung ist aktuell installiert?", type: "choice", options: [...HEATING_TYPES], required: false, active: true },
  { key: "postalCode", label: "PLZ", prompt: "In welcher Postleitzahl liegt das Gebäude?", type: "postal", options: [], required: true, active: true },
  { key: "name", label: "Name", prompt: "Wie lautet Ihr vollständiger Name?", type: "text", options: [], required: true, active: true },
  { key: "email", label: "E-Mail", prompt: "Unter welcher E-Mail-Adresse können wir Sie erreichen?", type: "email", options: [], required: true, active: true },
  { key: "phone", label: "Telefonnummer", prompt: "Unter welcher Telefonnummer erreichen wir Sie am besten?", type: "phone", options: [], required: false, active: true },
];

export const DEFAULT_ASSISTANT: AssistantSettings = {
  name: "Anna",
  greeting: "Hallo! Wie können wir Ihnen bei Ihrem Gebäude helfen?",
  tone: "friendly",
  autoReply: true,
  autoFollowUp: true,
  appointmentBooking: true,
  humanHandoff: true,
};

export const TONE_LABELS = { professional: "Professionell", friendly: "Freundlich", short: "Kurz" } as const;

export const STATUS_LABELS = {
  NEW: "Neu",
  NEEDS_INFO: "Rückfrage",
  COMPLETE: "Vollständig",
  CONTACTED: "Übernommen",
  APPOINTMENT: "Termin",
  CLOSED: "Archiviert",
} as const;

export const ROLE_LABELS = { OWNER: "Inhaber", ADMIN: "Admin", MEMBER: "Mitarbeiter" } as const;

export const BUILDING_SHORT: Record<string, string> = { Einfamilienhaus: "EFH", Mehrfamilienhaus: "MFH", Sonstiges: "Sonst." };

export function buildingLabel(fields: Record<string, string>) {
  const type = BUILDING_SHORT[fields.buildingType] ?? fields.buildingType ?? "";
  return [type, fields.yearBuilt].filter(Boolean).join(", ") || "–";
}
