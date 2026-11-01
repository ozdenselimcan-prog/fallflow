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
  /** Häufige Frage setzen (Antwort) bzw. entfernen (null) – landet in „Wissen & Preise“ */
  faq?: { q: string; a: string | null };
  /** Feste Preise ergänzen bzw. ersetzen (gleiche Bezeichnung) – „Wissen & Preise“ */
  prices?: { item: string; price: string }[];
  /** Fotos vom Kunden anfordern (bei allen Leistungen) */
  photos?: boolean;
  quoteVatRate?: 19 | 7 | 0;
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
  apply: (decision: Decision, value: string, state: State) => SetupPatch;
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
const faqAnswer = (s: State, q: string) => s.profile.knowledge?.faqs.find((f) => f.q === q)?.a ?? "";

/** „Anfahrt 39 €; Stundensatz 55 €“ bzw. „Anfahrt = 39 €“ → Preisliste. */
export function parsePrices(v: string): { item: string; price: string }[] {
  return v
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .map((part) => {
      const m = part.match(/^(.+?)\s*(?:[:=–-]\s*|\s)((?:ab\s+|ca\.\s+)?\d[\d.,]*\s*(?:€|EUR|Euro).*)$/i);
      return m ? { item: m[1].trim().replace(/[:=–-]$/, "").trim(), price: m[2].trim() } : null;
    })
    .filter((p): p is { item: string; price: string } => Boolean(p && p.item && p.price))
    .slice(0, 30);
}

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
  // Termine (Fortsetzung)
  {
    id: "saturday",
    group: "Termine",
    question: "Bieten Sie auch samstags Termine an?",
    otherPlaceholder: "z. B. nur jeden zweiten Samstag",
    current: (s) => yn(s.assistant.workingDays.includes(6)),
    apply: (d, _v, s) => ({ assistant: { workingDays: d === "yes" ? [...new Set([...s.assistant.workingDays, 6])].sort() : s.assistant.workingDays.filter((x) => x !== 6) } }),
  },
  {
    id: "duration",
    group: "Termine",
    question: "Dauert ein typischer Termin bei Ihnen etwa eine Stunde?",
    hint: "Nein: 2 Stunden. Andere Dauer? „Sonstiges“, z. B. „30 Minuten“ oder „halber Tag“.",
    otherPlaceholder: "z. B. 30 Minuten",
    valueHint: "Die Dauer eines Termins in Minuten als reine Zahl (z. B. „30“, „90“, „240“ für einen halben Tag). Leer, wenn keine Dauer genannt.",
    current: (s) => yn(s.assistant.slotMinutes === 60),
    apply: (d, v) => {
      const minutes = Number(v.match(/\d+/)?.[0] ?? NaN);
      if (Number.isFinite(minutes) && minutes >= 15 && minutes <= 600) return { assistant: { slotMinutes: Math.round(minutes / 15) * 15 } };
      return { assistant: { slotMinutes: d === "yes" ? 60 : 120 } };
    },
  },
  {
    id: "maxPerDay",
    group: "Termine",
    question: "Sollen pro Tag nur wenige Termine vergeben werden (höchstens 3)?",
    hint: "Nein: so viele, wie in Ihre Zeiten passen.",
    otherPlaceholder: "z. B. höchstens 2 pro Tag",
    valueHint: "Die gewünschte Höchstzahl an Terminen pro Tag als reine Zahl. Leer, wenn keine Zahl genannt.",
    current: (s) => yn(s.assistant.maxAppointmentsPerDay !== null && s.assistant.maxAppointmentsPerDay <= 3),
    apply: (d, v) => {
      const n = Number(v.match(/\d+/)?.[0] ?? NaN);
      if (Number.isFinite(n) && n >= 1 && n <= 50) return { assistant: { maxAppointmentsPerDay: n } };
      return { assistant: { maxAppointmentsPerDay: d === "yes" ? 3 : null } };
    },
  },
  // Unterlagen
  {
    id: "photos",
    group: "Unterlagen",
    question: "Sollen Kunden Fotos schicken (z. B. vom Schaden oder vom Raum)?",
    hint: "Ja: FallFlow bittet bei jeder Anfrage um Fotos – sie landen in der Fallakte und die KI schätzt sie für Sie ein.",
    otherPlaceholder: "z. B. nur bei Reparaturen",
    current: (s) => yn(s.profile.documents.some((d) => /foto|bild/i.test(d))),
    apply: (d) => ({ photos: d === "yes" }),
  },
  // Preise & Fragen von Kunden
  {
    id: "prices",
    group: "Preise & Fragen von Kunden",
    question: "Haben Sie feste Preise, die FallFlow Kunden nennen darf?",
    hint: "Z. B. Anfahrt oder Stundensatz. Alles andere fragt FallFlow nie selbst – Preise nennt die KI nur aus dieser Liste.",
    extra: { label: "Ihre Preise (mit ; trennen)", placeholder: "Anfahrt 39 €; Stundensatz 55 €" },
    otherPlaceholder: "z. B. Anfahrt 39 €, Stunde 55 €",
    valueHint: "Die genannten Preise als Liste im Format „Bezeichnung = Preis“, getrennt durch „;“ (z. B. „Anfahrt = 39 €; Stundensatz = 55 €“). Leer, wenn keine Preise genannt.",
    current: (s) => yn((s.profile.knowledge?.prices.length ?? 0) > 0),
    apply: (_d, v) => ({ prices: parsePrices(v) }),
  },
  {
    id: "hours",
    group: "Preise & Fragen von Kunden",
    question: "Darf FallFlow Kunden sagen, wann Sie erreichbar sind?",
    extra: { label: "Ihre Zeiten", placeholder: "Mo–Fr 8–17 Uhr, Sa 9–12 Uhr" },
    otherPlaceholder: "z. B. Mo–Fr 7–16 Uhr",
    valueHint: "Die Erreichbarkeit bzw. Öffnungszeiten als kurzer Satz für Kunden (z. B. „Sie erreichen uns Mo–Fr von 7 bis 16 Uhr.“).",
    current: (s) => yn(Boolean(faqAnswer(s, "Wann sind Sie erreichbar?"))),
    apply: (d, v) => ({ faq: { q: "Wann sind Sie erreichbar?", a: d === "yes" && v.trim() ? v.trim() : null } }),
  },
  {
    id: "area",
    group: "Preise & Fragen von Kunden",
    question: "Arbeiten Sie nur in einem bestimmten Gebiet?",
    extra: { label: "Ihr Gebiet", placeholder: "Stuttgart und 30 km Umkreis" },
    otherPlaceholder: "z. B. ganz Baden-Württemberg",
    valueHint: "Das Einsatzgebiet als kurzer Satz für Kunden (z. B. „Wir sind in Stuttgart und im Umkreis von 30 km für Sie da.“).",
    current: (s) => yn(Boolean(faqAnswer(s, "In welchem Gebiet sind Sie tätig?"))),
    apply: (d, v) => ({ faq: { q: "In welchem Gebiet sind Sie tätig?", a: d === "yes" && v.trim() ? v.trim() : null } }),
  },
  {
    id: "freeEstimate",
    group: "Preise & Fragen von Kunden",
    question: "Sind Besichtigung bzw. Kostenvoranschlag bei Ihnen kostenlos?",
    otherPlaceholder: "z. B. kostenlos, wenn Sie den Auftrag erteilen",
    valueHint: "Die Antwort als kurzer, freundlicher Satz für Kunden (z. B. „Die Besichtigung kostet 49 €, die wir bei Auftragserteilung verrechnen.“).",
    current: (s) => yn(faqAnswer(s, "Ist der Kostenvoranschlag kostenlos?").startsWith("Ja")),
    apply: (d, v) => ({
      faq: {
        q: "Ist der Kostenvoranschlag kostenlos?",
        a: v.trim() || (d === "yes" ? "Ja, Besichtigung und Kostenvoranschlag sind für Sie kostenlos und unverbindlich." : "Für Besichtigung und Kostenvoranschlag berechnen wir eine Gebühr – die genauen Kosten nennen wir Ihnen gern vorab."),
      },
    }),
  },
  {
    id: "payment",
    group: "Preise & Fragen von Kunden",
    question: "Soll FallFlow Kunden sagen, wie sie bei Ihnen bezahlen können?",
    extra: { label: "Zahlungsarten", placeholder: "Überweisung, EC-Karte, bar" },
    otherPlaceholder: "z. B. nur Überweisung",
    valueHint: "Die Zahlungsarten als kurzer Satz für Kunden (z. B. „Sie können per Überweisung oder bar bezahlen.“).",
    current: (s) => yn(Boolean(faqAnswer(s, "Wie kann ich bezahlen?"))),
    apply: (d, v) => ({ faq: { q: "Wie kann ich bezahlen?", a: d === "yes" && v.trim() ? v.trim() : null } }),
  },
  {
    id: "smallBusiness",
    group: "Preise & Fragen von Kunden",
    question: "Sind Sie Kleinunternehmer (Rechnungen ohne Umsatzsteuer)?",
    hint: "Dann erstellt FallFlow Angebote ohne Umsatzsteuer, mit dem Hinweis nach § 19 UStG.",
    otherPlaceholder: "z. B. 7 % Umsatzsteuer",
    valueHint: "Der Umsatzsteuersatz als Zahl: „0“ (Kleinunternehmer), „7“ oder „19“. Leer, wenn nicht genannt.",
    current: (s) => yn(s.profile.quoteDefaults?.vatRate === 0),
    apply: (d, v) => {
      const rate = Number(v.match(/\d+/)?.[0] ?? NaN);
      if (rate === 0 || rate === 7 || rate === 19) return { quoteVatRate: rate };
      return { quoteVatRate: d === "yes" ? 0 : 19 };
    },
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
