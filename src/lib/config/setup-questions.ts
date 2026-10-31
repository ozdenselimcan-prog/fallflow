import type { AssistantSettings, BusinessProfile } from "@/lib/data/types";

/**
 * Einrichtungs-Fragebogen: kurze Fragen mit Ja / Nein / Sonstiges. Jede Antwort stellt direkt die passenden Einstellungen ein
 * (Automatik, Assistent, Kundentexte) – der Betrieb muss keine Schalter oder Textfelder suchen. Bei „Sonstiges“ tippt er seine
 * eigene Antwort; die KI liest daraus Ja/Nein und ggf. einen Wert (z. B. Grußformel, Bewertungslink), siehe ai/setup-answer.ts.
 */
export type Decision = "yes" | "no";
export type Choice = Decision | "other";

export interface SetupAnswer {
  choice: Choice;
  /** Eigene Antwort bei „Sonstiges“ */
  text?: string;
  /** Zusatzangabe bei „Ja“ (z. B. Bewertungslink) */
  extra?: string;
}

export interface SetupPatch {
  assistant?: Partial<AssistantSettings>;
  automation?: Partial<NonNullable<BusinessProfile["automation"]>>;
  texts?: Record<string, string>;
  needsAddress?: boolean;
}

interface State {
  assistant: AssistantSettings;
  profile: BusinessProfile;
}

export interface SetupQuestion {
  id: string;
  group: string;
  question: string;
  hint?: string;
  /** Platzhalter für das Feld bei „Sonstiges“ */
  otherPlaceholder: string;
  /** Was die KI bei „Sonstiges“ außer Ja/Nein herauslesen soll (leer = nur Ja/Nein). */
  valueHint?: string;
  /** Zusatzfeld bei „Ja“ */
  extra?: { label: string; placeholder: string };
  /** Aktueller Stand aus den Einstellungen (für die Vorauswahl). */
  current: (s: State) => Decision;
  apply: (decision: Decision, value: string) => SetupPatch;
}

const a = (s: State) => s.profile.automation ?? {};
const yn = (v: boolean): Decision => (v ? "yes" : "no");
const isUrl = (v: string) => /^https:\/\/\S+$/.test(v.trim());
/** Satz mit Telefonnummer: fehlt der Platzhalter, wird „unter {telefon}“ angehängt. */
const withPhone = (v: string) => {
  const t = v.trim();
  if (!t || t.includes("{telefon}")) return t;
  return `${t.replace(/[.!]+$/, "")} unter {telefon}.`;
};
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const SETUP_QUESTIONS: SetupQuestion[] = [
  // Anfragen
  {
    id: "autoReply",
    group: "Anfragen",
    question: "Soll FallFlow neue Kundenanfragen automatisch beantworten?",
    hint: "Nein: FallFlow bereitet die Fälle nur vor, Sie antworten selbst.",
    otherPlaceholder: "z. B. nur außerhalb der Bürozeiten",
    current: (s) => yn(s.assistant.autoReply),
    apply: (d) => ({ assistant: { autoReply: d === "yes" } }),
  },
  {
    id: "autoFollowUp",
    group: "Anfragen",
    question: "Soll FallFlow fehlende Angaben und Unterlagen selbst beim Kunden nachfragen?",
    otherPlaceholder: "z. B. nur Angaben, Unterlagen frage ich selbst an",
    current: (s) => yn(s.assistant.autoFollowUp),
    apply: (d) => ({ assistant: { autoFollowUp: d === "yes" } }),
  },
  {
    id: "reminders",
    group: "Anfragen",
    question: "Soll FallFlow nachhaken, wenn ein Kunde nicht antwortet?",
    hint: "Freundliche Erinnerung per E-Mail nach 2 und nach 5 Tagen.",
    otherPlaceholder: "z. B. nur einmal erinnern",
    current: (s) => yn(a(s).reminders !== false),
    apply: (d) => ({ automation: { reminders: d === "yes" } }),
  },
  {
    id: "onSite",
    group: "Anfragen",
    question: "Arbeiten Sie beim Kunden vor Ort?",
    hint: "Ja: FallFlow fragt nach der Adresse. Nein (z. B. Salon, Werkstatt): ohne Adresse.",
    otherPlaceholder: "z. B. teils vor Ort, teils bei uns",
    current: (s) => yn(s.profile.needsAddress !== false),
    apply: (d) => ({ needsAddress: d === "yes" }),
  },
  {
    id: "multilingual",
    group: "Anfragen",
    question: "Sollen Kunden, die kein Deutsch sprechen, in ihrer Sprache Antwort bekommen?",
    hint: "Sie selbst lesen und schreiben weiter auf Deutsch – FallFlow übersetzt.",
    otherPlaceholder: "z. B. nur Englisch",
    current: (s) => yn(a(s).multilingual !== false),
    apply: (d) => ({ automation: { multilingual: d === "yes" } }),
  },
  {
    id: "handoff",
    group: "Anfragen",
    question: "Sollen Kunden jederzeit einen Mitarbeiter verlangen können?",
    hint: "Dann übergibt die KI sofort an Sie, statt weiterzufragen.",
    otherPlaceholder: "z. B. nur bei Notfällen",
    current: (s) => yn(s.assistant.humanHandoff),
    apply: (d) => ({ assistant: { humanHandoff: d === "yes" } }),
  },
  // Termine
  {
    id: "appointments",
    group: "Termine",
    question: "Soll FallFlow Termine mit Ihren Kunden vereinbaren?",
    hint: "Nein: Sie vereinbaren Termine selbst, FallFlow sammelt nur die Angaben.",
    otherPlaceholder: "z. B. nur Besichtigungstermine",
    current: (s) => yn(s.assistant.appointmentBooking),
    apply: (d) => ({ assistant: { appointmentBooking: d === "yes" } }),
  },
  {
    id: "bookingLink",
    group: "Termine",
    question: "Sollen Kunden ihren Termin selbst über einen Link aus Ihren freien Zeiten wählen?",
    hint: "Nein: FallFlow schlägt selbst den nächsten freien Termin vor.",
    otherPlaceholder: "z. B. lieber selbst vorschlagen",
    current: (s) => yn(a(s).bookingLink !== false),
    apply: (d) => ({ automation: { bookingLink: d === "yes" } }),
  },
  {
    id: "autoConfirm",
    group: "Termine",
    question: "Dürfen Termine ohne Ihre Bestätigung fest vergeben werden?",
    hint: "Nein: Sie bestätigen jeden Termin mit einem Klick im Kalender.",
    otherPlaceholder: "z. B. nur vormittags",
    current: (s) => yn(a(s).autoConfirm === true),
    apply: (d) => ({ automation: { autoConfirm: d === "yes" } }),
  },
  {
    id: "apptReminders",
    group: "Termine",
    question: "Sollen Kunden am Tag vor dem Termin eine Erinnerung bekommen?",
    otherPlaceholder: "z. B. nur bei Terminen beim Kunden",
    current: (s) => yn(a(s).apptReminders !== false),
    apply: (d) => ({ automation: { apptReminders: d === "yes" } }),
  },
  // Notfälle & Benachrichtigungen
  {
    id: "emergency",
    group: "Notfälle & Benachrichtigungen",
    question: "Sind Sie bei Notfällen telefonisch erreichbar?",
    hint: "Ja: Bei dringenden Anfragen nennt FallFlow dem Kunden Ihre Telefonnummer.",
    otherPlaceholder: "z. B. werktags bis 20 Uhr",
    valueHint:
      "Ein kurzer, höflicher Satz an Kunden, wann bzw. wie sie den Betrieb in dringenden Fällen telefonisch erreichen, mit dem Platzhalter {telefon} für die Telefonnummer (z. B. „In dringenden Fällen erreichen Sie uns werktags bis 20 Uhr unter {telefon}.“). Leer, wenn die Antwort keine Zeiten o. Ä. nennt.",
    current: (s) => yn(s.profile.texts?.["email.urgentPhone"] !== "-"),
    apply: (d, v) => ({ texts: { "email.urgentPhone": d === "no" ? "-" : withPhone(v) } }),
  },
  {
    id: "notifyAttention",
    group: "Notfälle & Benachrichtigungen",
    question: "Möchten Sie eine E-Mail bekommen, wenn ein Kunde eine Frage hat, die Sie selbst beantworten sollten?",
    otherPlaceholder: "z. B. an buero@ihre-firma.de",
    valueHint: "Eine E-Mail-Adresse, an die die Benachrichtigungen gehen sollen, falls genannt – sonst leer.",
    current: (s) => yn(s.assistant.notifyAttention),
    apply: (d, v) => ({ assistant: { notifyAttention: d === "yes", ...(isEmail(v) ? { notifyEmail: v.trim() } : {}) } }),
  },
  {
    id: "notifyReady",
    group: "Notfälle & Benachrichtigungen",
    question: "Möchten Sie eine E-Mail bekommen, wenn ein Fall fertig vorbereitet ist?",
    otherPlaceholder: "z. B. nur einmal am Tag",
    valueHint: "Eine E-Mail-Adresse, an die die Benachrichtigungen gehen sollen, falls genannt – sonst leer.",
    current: (s) => yn(s.assistant.notifyReady),
    apply: (d, v) => ({ assistant: { notifyReady: d === "yes", ...(isEmail(v) ? { notifyEmail: v.trim() } : {}) } }),
  },
  // Nach dem Auftrag
  {
    id: "reviews",
    group: "Nach dem Termin",
    question: "Sollen zufriedene Kunden nach dem Termin um eine Google-Bewertung gebeten werden?",
    hint: "Den Link finden Sie in Ihrem Google-Unternehmensprofil unter „Nach Rezensionen fragen“.",
    extra: { label: "Ihr Bewertungslink", placeholder: "https://g.page/r/…/review" },
    otherPlaceholder: "z. B. ja, Link: https://g.page/r/…/review",
    valueHint: "Der Google-Bewertungslink (beginnt mit https://), falls genannt – sonst leer.",
    current: (s) => yn(a(s).reviews === true),
    apply: (d, v) => (isUrl(v) ? { automation: { reviews: d === "yes", reviewLink: v.trim() } } : { automation: { reviews: false } }),
  },
  // Ton
  {
    id: "short",
    group: "Ton Ihrer Nachrichten",
    question: "Sollen die Antworten eher kurz und sachlich sein?",
    hint: "Nein: freundlich und etwas ausführlicher.",
    otherPlaceholder: "z. B. locker, aber nicht zu lang",
    current: (s) => yn(s.assistant.tone === "short"),
    apply: (d) => ({ assistant: { tone: d === "yes" ? "short" : "friendly" } }),
  },
  {
    id: "greeting",
    group: "Ton Ihrer Nachrichten",
    question: "Sollen Kunden in E-Mails mit „Guten Tag Herr/Frau …“ angesprochen werden?",
    hint: "Nein: „Hallo …“.",
    otherPlaceholder: "z. B. „Sehr geehrte/r …“",
    valueHint: "Die gewünschte Anrede als Text mit dem Platzhalter {name} für den Namen des Kunden und Komma am Ende (z. B. „Sehr geehrte/r {name},“). Leer, wenn keine genannt.",
    current: (s) => yn(!s.profile.texts?.["email.greeting"] || s.profile.texts["email.greeting"].startsWith("Guten Tag")),
    apply: (d, v) => ({ texts: { "email.greeting": v.includes("{name}") ? v : d === "yes" ? "" : "Hallo {name}," } }),
  },
  {
    id: "signoff",
    group: "Ton Ihrer Nachrichten",
    question: "Sollen Ihre E-Mails mit „Viele Grüße“ und Ihrem Firmennamen enden?",
    hint: "Nein: „Mit freundlichen Grüßen“.",
    otherPlaceholder: "z. B. „Beste Grüße, Peter Pinsel“",
    valueHint: "Die gewünschte Grußformel als Text, Zeilenumbruch zwischen Gruß und Name; {firma} steht für den Firmennamen (z. B. „Beste Grüße\nPeter Pinsel“). Leer, wenn keine genannt.",
    current: (s) => yn(!s.profile.texts?.["email.signoff"] || s.profile.texts["email.signoff"].startsWith("Viele Grüße")),
    apply: (d, v) => ({ texts: { "email.signoff": v.trim() ? v.trim() : d === "yes" ? "" : "Mit freundlichen Grüßen\n{firma}" } }),
  },
];

export const setupQuestion = (id: string) => SETUP_QUESTIONS.find((q) => q.id === id);
