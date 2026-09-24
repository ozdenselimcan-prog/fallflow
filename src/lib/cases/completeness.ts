import type { Question } from "@/lib/data/types";

/** Marker für bewusst übersprungene optionale Fragen. */
export const SKIPPED = "—";

export const isAnswered = (fields: Record<string, string>, key: string) => Boolean(fields[key]?.trim());

/** Anteil beantworteter Pflichtfragen in Prozent (aktive Fragen). Ohne Pflichtfragen: 100. */
export function computeCompleteness(questions: Pick<Question, "key" | "required" | "active">[], fields: Record<string, string>) {
  const required = questions.filter((q) => q.active && q.required);
  if (required.length === 0) return 100;
  const done = required.filter((q) => isAnswered(fields, q.key) && fields[q.key] !== SKIPPED).length;
  return Math.round((done / required.length) * 100);
}

export const missingRequired = (questions: Pick<Question, "key" | "label" | "required" | "active">[], fields: Record<string, string>) =>
  questions.filter((q) => q.active && q.required && !(isAnswered(fields, q.key) && fields[q.key] !== SKIPPED));

/** Deterministische Kurzfassung ohne KI – wird nur aus vorhandenen Angaben gebaut. */
export function buildSummary(fields: Record<string, string>) {
  const parts: string[] = [];
  const who = fields.name ? "Der Kunde" : "Der Interessent";
  const type = fields.buildingType?.toLowerCase();
  const building = [
    type ? `ein ${type === "einfamilienhaus" ? "Einfamilienhaus" : fields.buildingType}` : "ein Gebäude",
    fields.yearBuilt ? `aus dem Jahr ${fields.yearBuilt}` : "",
    fields.livingArea ? `mit ca. ${fields.livingArea} m² Wohnfläche` : "",
    fields.heating ? `und ${fields.heating}-Heizung` : "",
    fields.postalCode ? `in ${fields.postalCode}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  parts.push(`${who} besitzt ${building}.`);
  if (fields.service) parts.push(`Er interessiert sich für: ${fields.service}.`);
  return parts.join(" ");
}
