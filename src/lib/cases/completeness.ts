import type { Question } from "@/lib/data/types";
import { BUILDING_SHORT } from "./fields";

/** Marker für bewusst übersprungene optionale Fragen. */
export const SKIPPED = "—";

export const isAnswered = (fields: Record<string, string>, key: string) => Boolean(fields[key]?.trim());

/** Anteil beantworteter Pflichtfragen in Prozent (aktive Fragen, ohne Dokumente). Ohne Pflichtfragen: 100. */
export function computeCompleteness(questions: Pick<Question, "key" | "required" | "active">[], fields: Record<string, string>) {
  const required = questions.filter((q) => q.active && q.required);
  if (required.length === 0) return 100;
  const done = required.filter((q) => isAnswered(fields, q.key) && fields[q.key] !== SKIPPED).length;
  return Math.round((done / required.length) * 100);
}

export const missingRequired = (questions: Pick<Question, "key" | "label" | "required" | "active">[], fields: Record<string, string>) =>
  questions.filter((q) => q.active && q.required && !(isAnswered(fields, q.key) && fields[q.key] !== SKIPPED));

const SERVICE_GOALS: Record<string, string> = {
  iSFP: "einen individuellen Sanierungsfahrplan (iSFP) und möchte zunächst die energetischen Sanierungsmöglichkeiten prüfen",
  Energieausweis: "einen Energieausweis",
  Energieberatung: "eine Energieberatung",
  Fördermittelberatung: "eine Fördermittelberatung und möchte die Fördermöglichkeiten klären",
  Baubegleitung: "eine energetische Baubegleitung",
  Heizung: "einen Heizungstausch und möchte die Möglichkeiten prüfen",
  Sanierung: "eine energetische Sanierung und möchte die sinnvollen Maßnahmen prüfen",
};

/** Deterministische Kurzfassung ohne KI – wird nur aus vorhandenen Angaben gebaut, nichts wird erfunden. */
export function buildSummary(fields: Record<string, string>) {
  const known = (k: string) => (fields[k] && fields[k] !== SKIPPED ? fields[k] : "");
  const who = known("name") ? "Der Kunde" : "Der Interessent";
  const type = known("buildingType");
  const short = BUILDING_SHORT[type] && type !== "Sonstiges" ? BUILDING_SHORT[type] : "";
  const building = [
    short ? `ein ${short}` : "ein Gebäude",
    known("yearBuilt") ? `aus dem Jahr ${known("yearBuilt")}` : "",
    known("livingArea") ? `mit ca. ${known("livingArea")} m² Wohnfläche` : "",
    known("postalCode") ? `in ${known("postalCode")}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const owner = known("ownerStatus");
  const verb = owner === "Eigentümer" ? "besitzt" : owner === "Verwalter" ? "verwaltet" : owner === "Mieter" ? "bewohnt" : "meldet";
  const parts = [verb === "meldet" ? `${who} meldet ${building} an.` : `${who} ${verb} ${building}.`];
  if (known("heating")) parts.push(`Aktuell wird mit ${known("heating")} geheizt.`);
  const service = known("service");
  if (service) {
    const goal = SERVICE_GOALS[service];
    parts.push(goal ? `${who} interessiert sich für ${goal}.` : `${who} interessiert sich für: ${service}.`);
  }
  return parts.join(" ");
}
