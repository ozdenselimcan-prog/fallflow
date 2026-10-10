import type { Appointment } from "@/lib/data/types";

/**
 * Terminvorschlagsfunktion: liest vom Kunden genannte Wochentage oder ein konkretes Datum aus Freitext,
 * sucht darin den nächsten freien Termin innerhalb der Bürozeiten (unter Berücksichtigung bestehender
 * Termine – auch vom Büro ohne Fallbezug eingetragener Blocker) und formatiert Vorschlag/Bestätigung.
 * Reine Logik, keine Datenbankzugriffe (die liegen in intake/engine.ts).
 *
 * Alle Uhrzeiten werden als Europe/Berlin-Ortszeit behandelt, unabhängig davon, in welcher Zeitzone der
 * Server läuft (Vercel läuft in UTC) – siehe berlinWallTimeToUtc/berlinTodayYmd.
 */

const TZ = "Europe/Berlin";
interface Ymd {
  y: number;
  m: number; // 1–12
  d: number;
}

/** Wandelt eine als Europe/Berlin-Ortszeit gemeinte Uhrzeit in den tatsächlichen UTC-Zeitpunkt um (DST-sicher). */
function berlinWallTimeToUtc(y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(guess).map((x) => [x.type, x.value])) as Record<string, string>;
  const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour === 24 ? 0 : +p.hour, +p.minute);
  return new Date(guess.getTime() + (guess.getTime() - shown));
}

/** Heutiges Kalenderdatum in Europe/Berlin (unabhängig von der Serverzeitzone). */
function berlinTodayYmd(from = new Date()): Ymd {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(from).map((x) => [x.type, x.value])) as Record<string, string>;
  return { y: +p.year, m: +p.month, d: +p.day };
}

const addDays = (ymd: Ymd, n: number): Ymd => {
  const t = Date.UTC(ymd.y, ymd.m - 1, ymd.d) + n * 86_400_000;
  const d = new Date(t);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
/** Kalender-Wochentag eines Datums (0=So…6=Sa) – zeitzonenunabhängig, da reine Kalenderarithmetik. */
const weekdayOf = (ymd: Ymd) => new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();

const WEEKDAY_NAMES = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const WEEKDAY_SHORT = ["so", "mo", "di", "mi", "do", "fr", "sa"];
const MONTH_NAMES = ["januar", "februar", "märz|maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
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

/**
 * Erkennt ein konkretes Kalenderdatum in Freitext: „15. Oktober“, „15.10.“, „15.10.2026“, „morgen“,
 * „übermorgen“, „nächsten Dienstag“. Ohne Treffer: null. Ein erkanntes Datum in der Vergangenheit
 * (z. B. Monat ohne Jahr, der dieses Jahr schon vorbei ist) wird auf das nächste passende Jahr gelegt.
 */
export function parseSpecificDate(text: string, from = new Date()): Ymd | null {
  const t = text.toLowerCase();
  const today = berlinTodayYmd(from);

  // \b erkennt "ü" nicht als Wortzeichen (reines ASCII) – ohne Unicode-Grenze würde "übermorgen" nie matchen.
  const UEBERMORGEN = /(?<![\p{L}\p{N}])übermorgen(?![\p{L}\p{N}])/iu;
  if (/\bmorgen\b/.test(t) && !UEBERMORGEN.test(t)) return addDays(today, 1);
  if (UEBERMORGEN.test(t)) return addDays(today, 2);

  const relWeekday = t.match(/\b(nächsten?|kommenden?|diesen)\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/);
  if (relWeekday) {
    const target = WEEKDAY_NAMES.indexOf(relWeekday[2]);
    for (let i = relWeekday[1].startsWith("diesen") ? 0 : 1; i <= 7; i++) {
      const cand = addDays(today, i);
      if (weekdayOf(cand) === target) return cand;
    }
  }

  const monthPattern = MONTH_NAMES.map((m) => `(?:${m})`).join("|");
  const byName = t.match(new RegExp(`\\b(\\d{1,2})\\.?\\s*(${monthPattern})\\b(?:\\s+(\\d{4}))?`, "i"));
  if (byName) {
    const day = +byName[1];
    const monthIdx = MONTH_NAMES.findIndex((m) => new RegExp(`^(?:${m})$`, "i").test(byName[2]));
    if (day >= 1 && day <= 31 && monthIdx >= 0) {
      const year = byName[3] ? +byName[3] : today.y;
      let cand: Ymd = { y: year, m: monthIdx + 1, d: day };
      if (!byName[3] && Date.UTC(cand.y, cand.m - 1, cand.d) < Date.UTC(today.y, today.m - 1, today.d)) cand = { ...cand, y: year + 1 };
      return cand;
    }
  }

  // Kein abschließendes \b: nach einem optionalen Jahr folgt oft nur ein Satzzeichen ("8.10." / "10.10.?"),
  // zwischen dem nichts als Wortgrenze zählt – (?!\d) reicht, um versehentliches Mid-Number-Matching zu vermeiden.
  const numeric = t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?!\d)/);
  if (numeric) {
    const day = +numeric[1];
    const month = +numeric[2];
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = numeric[3] ? (numeric[3].length === 2 ? 2000 + +numeric[3] : +numeric[3]) : today.y;
      let cand: Ymd = { y: year, m: month, d: day };
      if (!numeric[3] && Date.UTC(cand.y, cand.m - 1, cand.d) < Date.UTC(today.y, today.m - 1, today.d)) cand = { ...cand, y: year + 1 };
      return cand;
    }
  }
  return null;
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
  /** Höchstzahl an Terminen pro Kalendertag – null/undefined = unbegrenzt. */
  maxAppointmentsPerDay?: number | null;
  /** Urlaubszeitraum (inklusive Start-/Enddatum "YYYY-MM-DD") – an diesen Tagen werden keine Termine vergeben. */
  vacation?: { from: string; until: string } | null;
}

function parseYmdString(s: string): Ymd {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}
const ymdLte = (a: Ymd, b: Ymd) => (a.y !== b.y ? a.y < b.y : a.m !== b.m ? a.m < b.m : a.d <= b.d);
/** Liegt dieser Tag innerhalb des Urlaubszeitraums (inklusive)? */
function isOnVacation(ymd: Ymd, vacation?: { from: string; until: string } | null): boolean {
  if (!vacation) return false;
  return ymdLte(parseYmdString(vacation.from), ymd) && ymdLte(ymd, parseYmdString(vacation.until));
}

const MIN_LEAD_MS = 2 * 3_600_000; // mindestens 2 Stunden Vorlauf

function busyRanges(existing: Pick<Appointment, "startsAt" | "durationMin">[]) {
  return existing.map((a) => {
    const s = new Date(a.startsAt).getTime();
    return { start: s, end: s + a.durationMin * 60_000 };
  });
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const ymdKey = (ymd: Ymd) => `${ymd.y}-${String(ymd.m).padStart(2, "0")}-${String(ymd.d).padStart(2, "0")}`;
/** Anzahl bestehender Termine an einem Kalendertag (Europe/Berlin) – für die Tagesobergrenze. */
function countOnDay(ymd: Ymd, existing: Pick<Appointment, "startsAt" | "durationMin">[]): number {
  const key = ymdKey(ymd);
  return existing.filter((a) => dayFmt.format(new Date(a.startsAt)) === key).length;
}

/** Erster freier Slot an einem einzelnen Kalendertag innerhalb der Bürozeit, oder null (Tag komplett belegt oder Tagesobergrenze erreicht). */
function firstFreeSlotOnDay(ymd: Ymd, slotStart: string, slotEnd: string, slotMinutes: number, existing: Pick<Appointment, "startsAt" | "durationMin">[], maxPerDay?: number | null): Date | null {
  if (maxPerDay && countOnDay(ymd, existing) >= maxPerDay) return null;
  const busy = busyRanges(existing);
  const start = parseTime(slotStart);
  const end = parseTime(slotEnd);
  let cursorMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  while (cursorMin + slotMinutes <= endMin) {
    const slot = berlinWallTimeToUtc(ymd.y, ymd.m, ymd.d, Math.floor(cursorMin / 60), cursorMin % 60);
    const slotEndMs = slot.getTime() + slotMinutes * 60_000;
    const early = slot.getTime() < Date.now() + MIN_LEAD_MS;
    const overlaps = busy.some((b) => slot.getTime() < b.end && slotEndMs > b.start);
    if (!early && !overlaps) return slot;
    cursorMin += slotMinutes;
  }
  return null;
}

/** Sucht den nächsten freien Termin: Schnittmenge aus Bürotagen und Kundentagen, innerhalb der Bürozeit, ohne Überschneidung, unter der Tagesobergrenze. */
export function findNextSlot(input: SlotSearch): Date | null {
  const allowedDays = new Set(input.workingDays.filter((d) => input.customerDays.includes(d)));
  if (allowedDays.size === 0) return null;
  const start = berlinTodayYmd(input.from ?? new Date());
  const horizon = input.horizonDays ?? 21;

  for (let i = 0; i <= horizon; i++) {
    const day = addDays(start, i);
    if (!allowedDays.has(weekdayOf(day)) || isOnVacation(day, input.vacation)) continue;
    const slot = firstFreeSlotOnDay(day, input.slotStart, input.slotEnd, input.slotMinutes, input.existing, input.maxAppointmentsPerDay);
    if (slot) return slot;
  }
  return null;
}

export type DateSlotReason = "ok" | "not_a_working_day" | "fully_booked" | "on_vacation";

/** Prüft ein vom Kunden genanntes konkretes Datum: frei, kein Bürotag, im Urlaub, oder ausgebucht (auch bei erreichter Tagesobergrenze). */
export function findSlotOnDate(ymd: Ymd, input: Omit<SlotSearch, "customerDays" | "from">): { slot: Date | null; reason: DateSlotReason } {
  if (!input.workingDays.includes(weekdayOf(ymd))) return { slot: null, reason: "not_a_working_day" };
  if (isOnVacation(ymd, input.vacation)) return { slot: null, reason: "on_vacation" };
  const slot = firstFreeSlotOnDay(ymd, input.slotStart, input.slotEnd, input.slotMinutes, input.existing, input.maxAppointmentsPerDay);
  return slot ? { slot, reason: "ok" } : { slot: null, reason: "fully_booked" };
}

/** Datum eines Ymd als UTC-Mitternacht-Date für findNextSlot({ from }) – nur zum Weitersuchen ab diesem Tag. */
export const ymdToDate = (ymd: Ymd) => new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12));

const dateFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const formatSlot = (d: Date) => `${dateFmt.format(d)} um ${timeFmt.format(d)} Uhr`;
export const formatYmd = (ymd: Ymd) => dateFmt.format(new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12)));

/** Kurze, für den jeweiligen Ton passende Formulierung der Verfügbarkeits-Frage. */
export function availabilityQuestion(workingDays: number[]): string {
  const names = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const example = workingDays.length >= 5 ? `${names[workingDays[0]]} bis ${names[workingDays[workingDays.length - 1]]}` : workingDays.map((d) => names[d]).join(", ");
  return `An welchen Wochentagen (oder an welchem konkreten Datum) passt es Ihnen am besten für ein Beratungsgespräch? (z. B. „${example}“ oder „15. Oktober“)`;
}

// Der konkrete Termin wird dem Kunden bewusst NICHT direkt von der KI genannt – ein Mitarbeiter bestätigt
// erst im Kalender (oder waehlt selbst einen anderen Zeitpunkt), danach erst erfaehrt der Kunde das Datum.
export const appointmentPendingReviewText = "Vielen Dank! Ich habe einen passenden Termin für Sie vorbereitet. Ein Mitarbeiter bestätigt Ihnen den genauen Termin in Kürze.";
export const APPOINTMENT_PLACEHOLDER = "(Termin)";
export const DEFAULT_APPOINTMENT_CONFIRMED_TEMPLATE = `Termin bestätigt: ${APPOINTMENT_PLACEHOLDER}. Wir freuen uns auf das Gespräch!`;
/**
 * Nachricht an den Kunden, sobald ein Mitarbeiter den Termin bestätigt. `template` ist der vom Büro
 * editierbare Text (Einstellungen → Vorlagen & Nachrichten); der Platzhalter "(Termin)" wird durch
 * Datum/Uhrzeit ersetzt. Fehlt der Platzhalter im eigenen Text, wird KEIN Datum angehängt – z. B. wenn das
 * Büro danach lieber telefonisch Kontakt aufnimmt, statt den Termin per Mail zu nennen. Leer/kein Text =
 * Standardformulierung.
 */
export function appointmentConfirmedText(slot: Date, template?: string): string {
  const t = template?.trim() || DEFAULT_APPOINTMENT_CONFIRMED_TEMPLATE;
  return t.includes(APPOINTMENT_PLACEHOLDER) ? t.replace(APPOINTMENT_PLACEHOLDER, formatSlot(slot)) : t;
}

/** Kunde sagt einen bereits bestätigten Termin ab (nur relevant innerhalb eines bekannten, laufenden Falls). */
const CANCEL = /\b(termin\s*(leider\s*)?(doch\s*)?(nicht\s*wahrnehmen|absagen|canceln|stornieren)|termin\s*fällt\s*(leider\s*)?aus|(muss|möchte)\s*(den\s*)?termin\s*(leider\s*)?absagen|schaffe\s*es\s*(leider\s*)?nicht|kann\s*(den\s*)?termin\s*(leider\s*)?nicht\s*(wahrnehmen|einhalten)|termin\s*verschieben)\b/i;
export const looksLikeCancellation = (text: string) => CANCEL.test(text.trim());
export const appointmentCancelledText = "Kein Problem, der Termin ist storniert. Sagen Sie uns gerne, welche Wochentage oder welches Datum stattdessen für Sie passen würden.";
export const appointmentRescheduleQueuedText = "Danke für die Rückmeldung! Der bisherige Termin ist storniert, und ich habe bereits einen neuen passenden Termin für Sie vorbereitet. Ein Mitarbeiter bestätigt ihn Ihnen in Kürze.";
export const noSlotFoundText = "Leider konnte ich in den nächsten Wochen keinen passenden Termin finden. Ein Mitarbeiter meldet sich bei Ihnen, um einen Termin zu vereinbaren.";
export function noOverlapText(workingDays: number[]): string {
  const names = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const offered = workingDays.map((d) => names[d]).join(", ");
  return `An diesen Tagen bieten wir leider keine Termine an. Wir sind an folgenden Tagen verfügbar: ${offered}. Würde einer davon für Sie passen?`;
}
export const availabilityNotUnderstoodText = "Das habe ich leider nicht verstanden. Bitte nennen Sie mir die Wochentage oder ein konkretes Datum, z. B. „Montag bis Freitag“ oder „15. Oktober“.";
export const notAWorkingDayText = (ymd: Ymd) => `Am ${formatYmd(ymd)} bieten wir leider keine Termine an.`;
export const fullyBookedText = (ymd: Ymd) => `Der ${formatYmd(ymd)} ist leider schon ausgebucht.`;
export const onVacationText = (ymd: Ymd) => `Am ${formatYmd(ymd)} sind wir leider im Urlaub und bieten keine Termine an.`;

export const WEEKDAY_LABELS_FULL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"] as const;
