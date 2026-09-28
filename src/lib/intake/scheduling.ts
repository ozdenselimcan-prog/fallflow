import type { Appointment } from "@/lib/data/types";

/**
 * Terminvorschlagsfunktion: liest die vom Kunden genannten Wochentage aus Freitext, sucht darin den
 * nächsten freien Termin innerhalb der Bürozeiten (unter Berücksichtigung bestehender Termine) und
 * formatiert Vorschlag/Bestätigung. Reine Logik, keine Datenbankzugriffe (die liegen in intake/engine.ts).
 */

const WEEKDAY_NAMES = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const WEEKDAY_SHORT = ["so", "mo", "di", "mi", "do", "fr", "sa"];
const ANYTIME = /\b(jederzeit|immer|egal|flexibel|wann (immer|es passt)|jeden tag)\b/i;

/** Erkennt Wochentage aus einer Kundenantwort, z. B. „Montag bis Freitag“, „Di, Do und Sa“, „jederzeit“. Ohne Treffer: null. */
export function parseAvailability(text: string): number[] | null {
  const t = ` ${text.toLowerCase().replace(/[.,;!?]/g, " ")} `;
  if (ANYTIME.test(t)) return [0, 1, 2, 3, 4, 5, 6];

  const dayIndex = (word: string): number => {
    const full = WEEKDAY_NAMES.findIndex((n) => word.startsWith(n));
    if (full >= 0) return full;
    return WEEKDAY_SHORT.findIndex((n) => word === n);
  };

  const wordPattern = /\p{L}{2,}/gu;
  const words = [...t.matchAll(wordPattern)].map((m) => m[0]);
  const found: { index: number; day: number }[] = [];
  words.forEach((w, i) => {
    const day = dayIndex(w);
    if (day >= 0) found.push({ index: i, day });
  });
  if (found.length === 0) return null;

  // „X bis Y“ direkt danebenstehend → als Bereich lesen; ansonsten alle genannten Tage einzeln übernehmen.
  const hasRangeWord = /\b(bis|–|-)\b/.test(t);
  if (hasRangeWord && found.length >= 2) {
    const between = words.slice(found[0].index + 1, found[found.length - 1].index).join(" ");
    if (/^(bis|–|-)$/.test(between.trim())) {
      const days: number[] = [];
      let d = found[0].day;
      const to = found[found.length - 1].day;
      for (let i = 0; i < 7; i++) {
        days.push(d);
        if (d === to) break;
        d = (d + 1) % 7;
      }
      return days;
    }
  }
  return [...new Set(found.map((f) => f.day))];
}

const parseTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
};

export interface SlotSearch {
  workingDays: number[];
  customerDays: number[];
  slotStart: string;
  slotEnd: string;
  slotMinutes: number;
  existing: Pick<Appointment, "startsAt" | "durationMin">[];
  from?: Date;
  horizonDays?: number;
}

/** Sucht den nächsten freien Termin: Schnittmenge aus Bürotagen und Kundentagen, innerhalb der Bürozeit, ohne Überschneidung. */
export function findNextSlot(input: SlotSearch): Date | null {
  const allowedDays = new Set(input.workingDays.filter((d) => input.customerDays.includes(d)));
  if (allowedDays.size === 0) return null;
  const start = parseTime(input.slotStart);
  const end = parseTime(input.slotEnd);
  const horizon = input.horizonDays ?? 21;
  const minLeadMs = 2 * 3_600_000; // mindestens 2 Stunden Vorlauf

  const busy = input.existing.map((a) => {
    const s = new Date(a.startsAt).getTime();
    return { start: s, end: s + a.durationMin * 60_000 };
  });

  const day = new Date(input.from ?? new Date());
  day.setSeconds(0, 0);

  for (let i = 0; i <= horizon; i++) {
    const d = new Date(day);
    d.setDate(d.getDate() + i);
    if (!allowedDays.has(d.getDay())) continue;

    let slot = new Date(d);
    slot.setHours(start.h, start.m, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(end.h, end.m, 0, 0);

    while (slot.getTime() + input.slotMinutes * 60_000 <= dayEnd.getTime()) {
      const slotEnd = slot.getTime() + input.slotMinutes * 60_000;
      const early = slot.getTime() < Date.now() + minLeadMs;
      const overlaps = busy.some((b) => slot.getTime() < b.end && slotEnd > b.start);
      if (!early && !overlaps) return new Date(slot);
      slot = new Date(slot.getTime() + input.slotMinutes * 60_000);
    }
  }
  return null;
}

const dateFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
export const formatSlot = (d: Date) => `${dateFmt.format(d)} um ${timeFmt.format(d)} Uhr`;

const CONFIRM = /^\s*(ja\b|jawohl|passt|okay?\b|einverstanden|gerne|klingt gut|super|perfekt|in ordnung|bestätig)/i;
export const looksLikeConfirmation = (text: string) => CONFIRM.test(text.trim());

const REJECT = /\b(nein|leider nicht|geht (bei mir |uns )?(leider )?nicht|passt (mir |uns )?(leider )?nicht|kann (ich )?(leider )?nicht|nicht möglich|anderen? (tag|termin|zeitpunkt)|andere zeit|verschieben|klappt nicht)\b/i;
export const looksLikeRejection = (text: string) => REJECT.test(text.trim());

/** Kurze, für den jeweiligen Ton passende Formulierung der Verfügbarkeits-Frage. */
export function availabilityQuestion(workingDays: number[]): string {
  const names = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const example = workingDays.length >= 5 ? `${names[workingDays[0]]} bis ${names[workingDays[workingDays.length - 1]]}` : workingDays.map((d) => names[d]).join(", ");
  return `An welchen Wochentagen passt es Ihnen am besten für ein Beratungsgespräch? (z. B. „${example}“)`;
}

export const appointmentProposalText = (slot: Date) => `Wie wäre es mit ${formatSlot(slot)}? Bitte bestätigen Sie kurz, ob der Termin für Sie passt.`;
export const appointmentReminderText = (slot: Date) => `Passt der Termin am ${formatSlot(slot)} für Sie? Bitte kurz bestätigen, oder nennen Sie mir andere Wochentage.`;
export const declinedRepromptText = (workingDays: number[]) => `Kein Problem, dann suche ich einen anderen Termin. ${availabilityQuestion(workingDays)}`;
export const rebookedText = (slot: Date) => `Wie wäre es stattdessen mit ${formatSlot(slot)}? Bitte bestätigen Sie kurz, ob das passt.`;
export const appointmentConfirmedText = (slot: Date) => `Termin bestätigt: ${formatSlot(slot)}. Wir freuen uns auf das Gespräch!`;
export const noSlotFoundText = "Leider konnte ich in den nächsten Wochen keinen passenden Termin finden. Ein Mitarbeiter meldet sich bei Ihnen, um einen Termin zu vereinbaren.";
export const availabilityNotUnderstoodText = "Das habe ich leider nicht verstanden. Bitte nennen Sie mir die Wochentage, an denen es Ihnen passt, z. B. „Montag bis Freitag“.";

export const WEEKDAY_LABELS_FULL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"] as const;
