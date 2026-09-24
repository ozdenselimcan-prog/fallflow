import type { AssistantSettings, CaseStatus, DocumentKind, Question } from "@/lib/data/types";

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
export const OWNER_STATUSES = ["Eigentümer", "Mieter", "Verwalter", "Sonstiges"] as const;
export const PRIORITIES = ["Normal", "Hoch", "Niedrig"] as const;

/** Energieversorgung wird aus der Heizung abgeleitet, nicht extra erfragt. */
export const ENERGY_SOURCE_BY_HEATING: Record<string, string> = {
  Gas: "Erdgas",
  Öl: "Heizöl",
  Wärmepumpe: "Strom",
  Fernwärme: "Fernwärme",
  "Holz/Pellets": "Holz/Pellets",
  Strom: "Strom",
};

/** Feldgruppen der Fallakte. */
export const FIELD_GROUPS: { title: string; fields: { key: string; label: string }[] }[] = [
  {
    title: "Kunde",
    fields: [
      { key: "name", label: "Name" },
      { key: "email", label: "E-Mail" },
      { key: "phone", label: "Telefon" },
      { key: "street", label: "Straße, Nr." },
      { key: "postalCode", label: "PLZ" },
      { key: "ownerStatus", label: "Eigentümerstatus" },
    ],
  },
  {
    title: "Gebäude",
    fields: [
      { key: "buildingType", label: "Gebäudetyp" },
      { key: "yearBuilt", label: "Baujahr" },
      { key: "livingArea", label: "Wohnfläche (m²)" },
      { key: "floors", label: "Etagen" },
      { key: "heating", label: "Heizung" },
      { key: "energySource", label: "Energieversorgung" },
      { key: "condition", label: "Zustand" },
    ],
  },
  {
    title: "Anliegen",
    fields: [
      { key: "service", label: "Gewünschte Leistung" },
      { key: "description", label: "Beschreibung" },
      { key: "priority", label: "Priorität" },
    ],
  },
];

type QuestionSeed = Omit<Question, "id" | "companyId" | "position">;

/** Standardfragen, die jedes neue Büro erhält (Reihenfolge = Abfragereihenfolge). */
export const DEFAULT_QUESTIONS: QuestionSeed[] = [
  { key: "service", label: "Gewünschte Leistung", prompt: "Welche Leistung möchten Sie anfragen?", type: "choice", options: [...SERVICES], required: true, active: true },
  { key: "buildingType", label: "Gebäudetyp", prompt: "Welche Art Gebäude ist es?", type: "choice", options: [...BUILDING_TYPES], required: true, active: true },
  { key: "yearBuilt", label: "Baujahr", prompt: "Was ist das Baujahr des Gebäudes?", type: "number", options: [], required: true, active: true },
  { key: "livingArea", label: "Wohnfläche", prompt: "Wie groß ist die Wohnfläche in m²?", type: "number", options: [], required: true, active: true },
  { key: "heating", label: "Heizung", prompt: "Welche Heizung ist aktuell installiert?", type: "choice", options: [...HEATING_TYPES], required: true, active: true },
  { key: "ownerStatus", label: "Eigentümerstatus", prompt: "Sind Sie Eigentümer, Mieter oder Verwalter des Gebäudes?", type: "choice", options: [...OWNER_STATUSES], required: true, active: true },
  { key: "street", label: "Straße", prompt: "Wie lautet die Adresse des Gebäudes (Straße und Hausnummer)?", type: "text", options: [], required: true, active: true },
  { key: "postalCode", label: "PLZ", prompt: "In welcher Postleitzahl liegt das Gebäude?", type: "postal", options: [], required: true, active: true },
  { key: "floors", label: "Etagen", prompt: "Wie viele Etagen (Vollgeschosse) hat das Gebäude?", type: "number", options: [], required: false, active: true },
  { key: "name", label: "Name", prompt: "Wie lautet Ihr vollständiger Name?", type: "text", options: [], required: true, active: true },
  { key: "email", label: "E-Mail", prompt: "Unter welcher E-Mail-Adresse können wir Sie erreichen?", type: "email", options: [], required: true, active: true },
  { key: "phone", label: "Telefonnummer", prompt: "Unter welcher Telefonnummer erreichen wir Sie am besten?", type: "phone", options: [], required: true, active: true },
];

/** Reihenfolge der Standardfragen (für das Nachziehen bestehender Büros in der Migration). */
export const DEFAULT_QUESTION_KEYS = DEFAULT_QUESTIONS.map((q) => q.key);

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

export const STATUS_LABELS: Record<CaseStatus, string> = {
  NEW: "Neu",
  QUALIFYING: "Wird qualifiziert",
  WAITING_FOR_CUSTOMER: "Wartet auf Kunde",
  COMPLETE: "Angaben vollständig",
  READY_FOR_REVIEW: "Bereit zur Prüfung",
  CONVERTED: "Übernommen",
};

export const STATUS_HINTS: Record<CaseStatus, string> = {
  NEW: "Anfrage eingegangen, noch nicht ausgewertet.",
  QUALIFYING: "Die KI sammelt gerade die fehlenden Informationen.",
  WAITING_FOR_CUSTOMER: "Es fehlen Angaben oder Dokumente vom Kunden.",
  COMPLETE: "Alle Pflichtangaben liegen vor, Dokumente sind noch nicht angefordert.",
  READY_FOR_REVIEW: "Fallakte vorbereitet – bereit zur Übernahme durch den Berater.",
  CONVERTED: "Vom Berater übernommen.",
};

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  floorplan: "Grundriss",
  energy_certificate: "Energieausweis",
  photos: "Fotos",
  other: "Sonstige Dokumente",
};

export const ROLE_LABELS = { OWNER: "Inhaber", ADMIN: "Admin", MEMBER: "Mitarbeiter" } as const;

export const BUILDING_SHORT: Record<string, string> = { Einfamilienhaus: "EFH", Mehrfamilienhaus: "MFH", Sonstiges: "Sonst." };

export function buildingLabel(fields: Record<string, string>) {
  const type = BUILDING_SHORT[fields.buildingType] ?? fields.buildingType ?? "";
  return [type, fields.yearBuilt].filter(Boolean).join(", ") || "–";
}
