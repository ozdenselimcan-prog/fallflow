import type { Appointment } from "@/lib/data/types";
import type { ChecklistItem } from "./checklist";
import { formatSlot } from "./scheduling";

/**
 * Fragen nach dem Stand eines laufenden Falls („Wann kommen Sie?“, „Haben Sie meine Fotos bekommen?“, „Gibt es schon
 * etwas Neues?“). Die beantwortet FallFlow selbst aus dem Fall (Termin, fehlende Angaben) – dafür muss niemand ans Postfach.
 * Bewusst NICHT: Terminwünsche („Wann hätten Sie Zeit?“), Absagen/Verschieben, Preis- oder Fachfragen.
 */
const STATUS_SENTENCE =
  /wie (ist|sieht) (es |denn )?(jetzt |nun )?(der |mit dem |mit meiner |mit unserer )?(stand|aus)\b|gibt es (schon |denn |jetzt )?(etwas |was )?neu(es|igkeiten)\b|(schon |noch )?(etwas|was) neues\b|(haben|hast|habt) (sie|du|ihr) (meine|unsere|die) (e-?mail|mail|nachricht|anfrage|fotos|bilder|unterlagen|dokumente|angaben)( schon| denn)? (erhalten|bekommen|gesehen)|(ist|sind) (meine|unsere|die) (e-?mail|mail|nachricht|anfrage|fotos|bilder|unterlagen|dokumente)( schon| denn| gut)? (angekommen|eingegangen|da)\b|wann (kommen|kommt) (sie|ihr|jemand|der handwerker|ihr mitarbeiter|der monteur)\b|wann (melden|meldet) (sie|ihr) sich|wann (ist|war) (mein|unser|der) termin|um wie ?viel uhr (kommen|kommt|ist)|(steht|gilt) (mein|unser|der) termin( noch)?|bleibt es (bei|beim) (dem )?termin|(noch )?nichts (mehr )?(von ihnen |von euch )?gehört|warte(n)? (immer )?noch auf (eine )?(antwort|rückmeldung|nachricht)/i;
const OTHER_TOPIC = /kost|preis|verschieb|absag|stornier|reklam|beschwer|notfall/i;

const sentencesOf = (text: string) =>
  text
    .split(/(?<=[?.!])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Fragt der Kunde (nur) nach dem Stand? Gibt den übrigen Text zurück, damit andere Fragen darin nicht untergehen. */
export function statusQuestion(text: string): { asked: boolean; rest: string } {
  const sentences = sentencesOf(text);
  const status = sentences.filter((s) => STATUS_SENTENCE.test(s) && !OTHER_TOPIC.test(s));
  return { asked: status.length > 0, rest: sentences.filter((s) => !status.includes(s)).join("\n") };
}

export interface StatusInput {
  appointments: Pick<Appointment, "startsAt" | "status">[];
  /** Fehlende Pflichtpunkte des Falls (Angaben und Unterlagen) */
  missing: (Pick<ChecklistItem, "label"> & { key?: string })[];
  /** Upload-Seite, falls noch Unterlagen fehlen */
  uploadLink?: string | null;
  /** Terminbuchung per Link: Kunde soll seinen Termin noch selbst wählen */
  bookingLink?: string | null;
  /** Texte des Betriebs (customerText) */
  T: (key: string, vars?: Record<string, string>) => string;
  now?: number;
}

/** Antwort auf die Frage nach dem Stand – immer aus dem, was im Fall wirklich steht. */
export function statusAnswer(input: StatusInput): string {
  const now = input.now ?? Date.now();
  const upcoming = input.appointments.filter((a) => Date.parse(a.startsAt) > now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const confirmed = upcoming.find((a) => a.status === "confirmed");
  if (confirmed) return input.T("status.appointment", { termin: formatSlot(new Date(confirmed.startsAt)) });
  const proposed = upcoming.find((a) => a.status === "proposed");
  if (proposed) return input.T("status.appointmentPending");
  if (input.missing.length) {
    // "Straße, Nr." liest sich in einer Aufzählung wie zwei Angaben – für den Kunden "Adresse" (wie in der ersten Antwort).
    const labels = [...new Set(input.missing.map((m) => (m.key === "street" ? "Adresse" : m.label)))];
    const liste = labels.slice(0, 6).join(", ").replace(/\.$/, "");
    return input.T("status.missing", { liste }).replace(/\.\.$/, ".") + (input.uploadLink ? ` ${input.T("status.uploadLink", { link: input.uploadLink })}` : "");
  }
  if (input.bookingLink) return input.T("status.chooseAppointment", { link: input.bookingLink });
  return input.T("status.inProgress");
}
