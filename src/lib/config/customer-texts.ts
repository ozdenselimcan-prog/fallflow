/**
 * Alle festen Texte, die FallFlow automatisch an Kunden schickt – an einer Stelle, damit der Betrieb jeden davon auf der
 * Seite „KI-Assistent → Texte“ ändern kann. Gespeichert werden nur Änderungen (companies.business_profile.texts);
 * ohne Änderung gilt der Standard. Platzhalter in geschweiften Klammern werden beim Versand ersetzt.
 */

export type TextGroup = "email" | "forms" | "appointment" | "reminder" | "chat" | "whatsapp" | "other";

export const TEXT_GROUPS: { id: TextGroup; title: string; hint: string }[] = [
  { id: "email", title: "E-Mail-Antworten", hint: "Antwort auf eine neue Anfrage per E-Mail – Anrede, Fragen nach fehlenden Angaben, Abschluss." },
  { id: "forms", title: "Formulare und Unterlagen", hint: "Wenn Formulare mitgeschickt, geprüft oder Unterlagen angefordert werden." },
  { id: "appointment", title: "Termine", hint: "Terminfrage, Terminvorschlag, Bestätigung, Absage." },
  { id: "reminder", title: "Erinnerungen", hint: "Wenn ein Kunde fehlende Angaben oder Unterlagen nicht schickt (nach 2 und nach 5 Tagen)." },
  { id: "chat", title: "WhatsApp und Website-Chat", hint: "Begrüßung, Abschluss und Übergabe im Chat." },
  { id: "whatsapp", title: "Nur WhatsApp", hint: "Sonderfälle im WhatsApp-Chat." },
  { id: "other", title: "Sonstiges", hint: "" },
];

export interface CustomerText {
  key: string;
  group: TextGroup;
  label: string;
  /** Wann wird der Text verschickt? */
  when: string;
  default: string;
  /** Platzhalter, die im Text vorkommen dürfen (ohne Klammern) */
  vars: string[];
}

const VAR_HELP: Record<string, string> = {
  name: "Name des Kunden",
  firma: "Name Ihres Betriebs",
  leistung: "erkannte Leistung",
  liste: "Aufzählung (Angaben, Unterlagen bzw. Formulare)",
  dokument: "Name des Formulars",
  hinweis: "Hinweis aus der automatischen Prüfung",
  beispiel: "Ihre Arbeitstage als Beispiel",
  tage: "Ihre Arbeitstage",
  datum: "Datum",
  termin: "Datum und Uhrzeit des Termins",
  frage: "die nächste offene Frage",
  link: "Link (zum Hochladen bzw. zur Terminbuchung)",
  bewertungslink: "Ihr Link zur Google-Bewertung",
  antwort: "Antwort aus „Wissen & Preise“",
  telefon: "Ihre Telefonnummer",
  nummer: "Angebotsnummer",
};
export const varHelp = (v: string) => VAR_HELP[v] ?? v;

export const CUSTOMER_TEXTS: CustomerText[] = [
  // E-Mail
  { key: "email.greeting", group: "email", label: "Anrede", when: "Am Anfang jeder automatischen E-Mail (nicht, wenn Ihr eigener Text schon mit einer Anrede beginnt).", default: "Guten Tag {name},", vars: ["name"] },
  { key: "email.signoff", group: "email", label: "Grußformel", when: "Am Ende jeder automatischen E-Mail (nicht, wenn Ihr eigener Text schon einen Gruß enthält).", default: "Viele Grüße\n{firma}", vars: ["firma"] },
  { key: "email.intro", group: "email", label: "Einleitung", when: "Erste Antwort auf eine Anfrage – nur, wenn Sie für die Leistung unter „Vorlagen & Nachrichten“ keinen eigenen Text hinterlegt haben.", default: "vielen Dank für Ihre Anfrage zu „{leistung}“.", vars: ["leistung"] },
  { key: "email.missing", group: "email", label: "Fehlende Angaben", when: "Wenn in der Anfrage Pflichtangaben fehlen.", default: "Damit wir Ihre Anfrage vorbereiten können, nennen Sie uns bitte noch: {liste}.", vars: ["liste"] },
  { key: "email.helpful", group: "email", label: "Hilfreiche Unterlagen", when: "Wenn zur Leistung typische Unterlagen (z. B. Fotos) hinterlegt sind.", default: "Sehr hilfreich wären noch: {liste} – gern einfach als Antwort auf diese E-Mail.", vars: ["liste"] },
  { key: "email.answer", group: "email", label: "Antwort auf eine Frage", when: "Wenn der Kunde eine Frage stellt, die FallFlow mit Ihren Angaben unter „Wissen & Preise“ beantworten kann.", default: "Zu Ihrer Frage: {antwort}", vars: ["antwort"] },
  { key: "email.received", group: "email", label: "Eingangsbestätigung", when: "Wenn eine E-Mail an Sie persönlich geht (Notfall, Reklamation, Frage, die die KI nicht beantworten kann).", default: "vielen Dank für Ihre Nachricht – wir haben sie erhalten und melden uns persönlich bei Ihnen.", vars: [] },
  { key: "email.urgentPhone", group: "email", label: "Hinweis bei Notfällen", when: "Zusätzlich zur Eingangsbestätigung, wenn die Nachricht nach einem Notfall klingt.", default: "In dringenden Fällen erreichen Sie uns telefonisch unter {telefon}.", vars: ["telefon"] },
  { key: "email.unclear", group: "email", label: "Rückfrage bei unklarer Anfrage", when: "Wenn aus der E-Mail nicht hervorgeht, worum es geht.", default: "vielen Dank für Ihre Nachricht! Damit wir Ihnen gezielt weiterhelfen können: Worum geht es genau? Wir bieten unter anderem {liste} an.", vars: ["liste"] },
  { key: "email.complete", group: "email", label: "Alle Angaben vollständig", when: "Wenn der Kunde alle Angaben geschickt hat (ohne automatischen Terminvorschlag).", default: "Vielen Dank, damit haben wir alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen.", vars: [] },
  { key: "email.completeConfirmed", group: "email", label: "Alle Angaben vollständig – Termin automatisch bestätigt", when: "Wenn „Termine automatisch bestätigen“ an ist; danach folgt der Text „Termin bestätigt“.", default: "Vielen Dank, damit haben wir alle Angaben.", vars: [] },
  { key: "email.completeAppointment", group: "email", label: "Alle Angaben vollständig – mit Terminvorschlag", when: "Wenn alle Angaben da sind und FallFlow einen Termin vorbereitet hat.", default: "Vielen Dank, damit haben wir alle Angaben. Wir haben bereits einen passenden Termin für Sie vorbereitet – ein Mitarbeiter bestätigt Ihnen den genauen Termin in Kürze.", vars: [] },

  // Formulare und Unterlagen
  { key: "forms.attachedOne", group: "forms", label: "Ein Formular im Anhang", when: "Wenn ein Formular zum Ausfüllen mitgeschickt wird.", default: "Im Anhang finden Sie das Formular „{dokument}“ – bitte ausfüllen und einfach als Antwort auf diese E-Mail zurücksenden.", vars: ["dokument"] },
  { key: "forms.attachedMany", group: "forms", label: "Mehrere Formulare im Anhang", when: "Wenn mehrere Formulare zum Ausfüllen mitgeschickt werden.", default: "Im Anhang finden Sie folgende Formulare: {liste} – bitte ausfüllen und einfach als Antwort auf diese E-Mail zurücksenden.", vars: ["liste"] },
  { key: "forms.returnHint", group: "forms", label: "Bitte zurückschicken", when: "Wenn Ihr eigener Text das Formular erwähnt, aber nicht sagt, wie es zurückkommt.", default: "Bitte senden Sie die ausgefüllten Unterlagen einfach als Antwort auf diese E-Mail zurück.", vars: [] },
  { key: "forms.info", group: "forms", label: "Dokumente nur zur Information", when: "Wenn Dokumente mitgeschickt werden, die nicht zurückkommen müssen (z. B. Preisliste).", default: "Zu Ihrer Information finden Sie außerdem im Anhang: {liste} – das muss nicht zurückgeschickt werden.", vars: ["liste"] },
  { key: "forms.required", group: "forms", label: "Unterlagen anfordern", when: "Wenn für die Leistung bestimmte Unterlagen Pflicht sind.", default: "Damit wir Ihre Anfrage bearbeiten können, schicken Sie uns bitte außerdem: {liste} – gern als PDF oder Foto, einfach als Antwort auf diese E-Mail.", vars: ["liste"] },
  { key: "forms.wrongDocument", group: "forms", label: "Falsches Dokument zurückgeschickt", when: "Wenn der Kunde ein anderes Dokument statt des Formulars schickt.", default: "Vielen Dank für Ihre Rückmeldung. {hinweis} Bitte schicken Sie uns stattdessen das Formular „{dokument}“ (im Anhang) ausgefüllt als Antwort auf diese E-Mail zurück.", vars: ["hinweis", "dokument"] },
  { key: "forms.incomplete", group: "forms", label: "Formular unvollständig", when: "Wenn ein zurückgeschicktes Formular noch nicht vollständig ausgefüllt ist.", default: "Vielen Dank für die zurückgeschickte Vorlage „{dokument}“. {hinweis} Bitte füllen Sie das Formular (im Anhang) vollständig aus und schicken Sie es uns erneut als Antwort auf diese E-Mail zurück.", vars: ["dokument", "hinweis"] },
  { key: "forms.uploadRequest", group: "forms", label: "Unterlagen per Link anfordern", when: "Wenn Sie im Fall „Unterlagen anfordern“ klicken.", default: "für die Vorbereitung Ihres Termins benötigen wir noch {liste}. Sie können die Unterlagen hier direkt und sicher hochladen: {link}\n\nVielen Dank!", vars: ["liste", "link"] },
  { key: "forms.chatUpload", group: "forms", label: "Unterlagen im Chat anfordern", when: "Im Chat, wenn alle Angaben da sind und noch Unterlagen fehlen.", default: "Zur Vorbereitung Ihres Termins benötigen wir außerdem noch {liste}. Sie können die Unterlagen direkt hier hochladen – oder später über den Link, den wir Ihnen senden.", vars: ["liste"] },

  // Termine
  { key: "appointment.ask", group: "appointment", label: "Frage nach dem Wunschtermin", when: "Im Chat, wenn alle Angaben da sind.", default: "An welchen Wochentagen (oder an welchem konkreten Datum) passt es Ihnen am besten für einen Termin? (z. B. „{beispiel}“ oder „15. Oktober“)", vars: ["beispiel"] },
  { key: "appointment.bookingLinkEmail", group: "appointment", label: "Buchungslink (E-Mail)", when: "Wenn alle Angaben da sind und der Kunde seinen Termin selbst wählen soll.", default: "Wählen Sie hier ganz einfach Ihren Wunschtermin aus: {link}", vars: ["link"] },
  { key: "appointment.bookingLinkChat", group: "appointment", label: "Buchungslink (WhatsApp/Chat)", when: "Im Chat, wenn alle Angaben da sind.", default: "Wählen Sie hier ganz einfach Ihren Wunschtermin aus: {link} – oder nennen Sie mir die Tage, an denen es Ihnen passt.", vars: ["link"] },
  { key: "appointment.pending", group: "appointment", label: "Termin vorbereitet", when: "Wenn FallFlow einen Termin vorschlägt, den Sie noch bestätigen.", default: "Ich habe einen passenden Termin für Sie vorbereitet. Ein Mitarbeiter bestätigt Ihnen den genauen Termin in Kürze.", vars: [] },
  { key: "appointment.confirmed", group: "appointment", label: "Termin bestätigt", when: "Wenn Sie einen Termin im Kalender bestätigen.", default: "Termin bestätigt: {termin}. Wir freuen uns auf Sie!", vars: ["termin"] },
  { key: "appointment.notUnderstood", group: "appointment", label: "Wunschtermin nicht verstanden", when: "Wenn der Kunde keinen Tag oder kein Datum nennt.", default: "Das habe ich leider nicht verstanden. Bitte nennen Sie mir die Wochentage oder ein konkretes Datum, z. B. „Montag bis Freitag“ oder „15. Oktober“.", vars: [] },
  { key: "appointment.noOverlap", group: "appointment", label: "Wunschtage passen nicht", when: "Wenn der Kunde nur Tage nennt, an denen Sie keine Termine anbieten.", default: "An diesen Tagen bieten wir leider keine Termine an. Wir sind an folgenden Tagen verfügbar: {tage}. Würde einer davon für Sie passen?", vars: ["tage"] },
  { key: "appointment.notWorkingDay", group: "appointment", label: "Kein Arbeitstag", when: "Wenn das Wunschdatum kein Arbeitstag ist.", default: "Am {datum} bieten wir leider keine Termine an.", vars: ["datum"] },
  { key: "appointment.fullyBooked", group: "appointment", label: "Ausgebucht", when: "Wenn das Wunschdatum schon voll ist.", default: "Der {datum} ist leider schon ausgebucht.", vars: ["datum"] },
  { key: "appointment.vacation", group: "appointment", label: "Urlaub", when: "Wenn das Wunschdatum in Ihren Urlaub fällt.", default: "Am {datum} sind wir leider im Urlaub und bieten keine Termine an.", vars: ["datum"] },
  { key: "appointment.noSlot", group: "appointment", label: "Kein freier Termin", when: "Wenn in den nächsten Wochen nichts frei ist.", default: "Leider konnte ich in den nächsten Wochen keinen passenden Termin finden. Ein Mitarbeiter meldet sich bei Ihnen, um einen Termin zu vereinbaren.", vars: [] },
  { key: "appointment.cancelled", group: "appointment", label: "Termin abgesagt", when: "Wenn der Kunde einen Termin absagt.", default: "Kein Problem, der Termin ist storniert. Sagen Sie uns gerne, welche Wochentage oder welches Datum stattdessen für Sie passen würden.", vars: [] },
  { key: "appointment.rescheduled", group: "appointment", label: "Termin verschoben", when: "Wenn der Kunde einen Termin verschiebt und neue Tage nennt.", default: "Danke für die Rückmeldung! Der bisherige Termin ist storniert, und ich habe bereits einen neuen passenden Termin für Sie vorbereitet. Ein Mitarbeiter bestätigt ihn Ihnen in Kürze.", vars: [] },

  // Erinnerungen
  { key: "reminder.first", group: "reminder", label: "Erste Erinnerung", when: "2 Tage nach der letzten Nachricht, wenn noch Angaben oder Unterlagen fehlen.", default: "wir möchten kurz an Ihre Anfrage zu „{leistung}“ erinnern. Damit wir weitermachen können, fehlen uns noch: {liste}. Antworten Sie einfach auf diese E-Mail.", vars: ["leistung", "liste"] },
  { key: "reminder.second", group: "reminder", label: "Zweite Erinnerung", when: "5 Tage nach der letzten Nachricht, wenn immer noch etwas fehlt.", default: "wir haben noch nichts von Ihnen gehört – besteht Ihre Anfrage zu „{leistung}“ noch? Dann schicken Sie uns bitte noch: {liste}. Antworten Sie einfach auf diese E-Mail.", vars: ["leistung", "liste"] },

  // Chat (WhatsApp und Website-Chat)
  { key: "chat.intro", group: "chat", label: "Begrüßung", when: "Erste Antwort im Chat.", default: "Vielen Dank für Ihre Nachricht!", vars: [] },
  { key: "chat.done", group: "chat", label: "Alle Angaben vollständig", when: "Wenn der Kunde alle Fragen beantwortet hat.", default: "Vielen Dank, damit habe ich alle Angaben. Ein Mitarbeiter meldet sich bei Ihnen.", vars: [] },
  { key: "chat.handoff", group: "chat", label: "Übergabe an das Team", when: "Wenn der Kunde mit einem Mitarbeiter sprechen möchte.", default: "Kein Problem – ich habe Ihre Anfrage an einen Mitarbeiter übergeben. Sie hören persönlich von uns.", vars: [] },
  { key: "chat.noFollowUp", group: "chat", label: "Anfrage angekommen (ohne Rückfragen)", when: "Wenn „Fehlende Angaben nachfragen“ ausgeschaltet ist.", default: "Vielen Dank! Ihre Anfrage ist bei uns angekommen und wir melden uns bei Ihnen.", vars: [] },
  { key: "chat.retry", group: "chat", label: "Antwort nicht verstanden", when: "Wenn eine Antwort nicht zur Frage passt.", default: "Das habe ich leider nicht ganz verstanden.", vars: [] },
  { key: "chat.question", group: "chat", label: "Fachfrage zwischendurch", when: "Wenn der Kunde während der Fragen eine Fachfrage stellt.", default: "Dazu meldet sich gerne unser Team persönlich bei Ihnen. Ich sammle zunächst die Angaben für Ihren Fall.", vars: [] },

  // Nur WhatsApp
  { key: "whatsapp.handoff", group: "whatsapp", label: "Frage für das Team", when: "Wenn eine Nachricht an Sie weitergeleitet wird (Notfall, Preisfrage, Reklamation …).", default: "Vielen Dank für Ihre Nachricht! Dazu meldet sich unser Team persönlich bei Ihnen.", vars: [] },
  { key: "whatsapp.sideQuestion", group: "whatsapp", label: "Zwischenfrage für das Team", when: "Wenn der Kunde mitten im Gespräch z. B. nach dem Preis fragt.", default: "Das klärt unser Team gern persönlich mit Ihnen – Sie bekommen dazu eine Antwort.", vars: [] },
  { key: "whatsapp.backToRequest", group: "whatsapp", label: "Zurück zur offenen Frage", when: "Nach einer Zwischenfrage, bevor die offene Frage wiederholt wird.", default: "Zurück zu Ihrer Anfrage: {frage}", vars: ["frage"] },
  { key: "whatsapp.documents", group: "whatsapp", label: "Bitte um Fotos und Unterlagen", when: "Wenn alle Angaben da sind und zur Leistung typische Unterlagen hinterlegt sind.", default: "Wenn Sie haben, schicken Sie uns gern noch: {liste} – einfach als Foto oder PDF hier im Chat.", vars: ["liste"] },
  { key: "whatsapp.audio", group: "whatsapp", label: "Sprachnachricht nicht verständlich", when: "Wenn eine Sprachnachricht nicht abgetippt werden konnte (z. B. zu leise oder zu lang).", default: "Ihre Sprachnachricht konnte ich leider nicht verstehen – schreiben Sie mir bitte kurz, worum es geht. Fotos und PDFs können Sie gern schicken.", vars: [] },
  { key: "whatsapp.unsupported", group: "whatsapp", label: "Nachricht nicht lesbar", when: "Wenn der Kunde z. B. einen Sticker oder Standort schickt.", default: "Diese Art Nachricht kann ich leider nicht lesen – schreiben Sie mir bitte kurz, worum es geht. Fotos und PDFs können Sie gern schicken.", vars: [] },
  { key: "whatsapp.fileError", group: "whatsapp", label: "Datei nicht lesbar", when: "Wenn eine geschickte Datei nicht geöffnet werden kann.", default: "Vielen Dank! Diese Datei konnte ich leider nicht öffnen – bitte schicken Sie sie als Foto oder PDF.", vars: [] },

  // Sonstiges
  { key: "quote.email", group: "other", label: "Angebot senden", when: "Wenn Sie im Fall ein Angebot (PDF) an den Kunden schicken.", default: "anbei erhalten Sie unser Angebot {nummer} zu „{leistung}“. Bei Fragen melden Sie sich gern – wir freuen uns auf Ihren Auftrag.", vars: ["nummer", "leistung"] },
  { key: "review.request", group: "other", label: "Bitte um Bewertung", when: "Am Tag nach einem bestätigten Termin, wenn „Nach dem Termin um eine Bewertung bitten“ eingeschaltet ist.", default: "vielen Dank für Ihr Vertrauen! Wir hoffen, Sie sind mit unserer Arbeit zufrieden. Über eine kurze Bewertung würden wir uns sehr freuen – das dauert nur eine Minute: {bewertungslink}", vars: ["bewertungslink"] },
  { key: "other.caseLimit", group: "other", label: "Monatliches Kontingent erreicht", when: "Wenn Ihr Tarif-Kontingent an Anfragen für diesen Monat aufgebraucht ist.", default: "Vielen Dank für Ihre Nachricht! Unser Büro hat die monatliche Kapazität für neue Anfragen aktuell erreicht. Bitte kontaktieren Sie uns direkt telefonisch oder versuchen Sie es zu Beginn des nächsten Monats erneut.", vars: [] },
];

export type TextKey = (typeof CUSTOMER_TEXTS)[number]["key"];
const BY_KEY = new Map(CUSTOMER_TEXTS.map((t) => [t.key, t]));
export const isTextKey = (key: string) => BY_KEY.has(key);

/** Platzhalter ersetzen; fehlt ein Wert, verschwindet der Platzhalter samt überflüssiger Leerzeichen ("Guten Tag ," → "Guten Tag,"). */
export function fillText(template: string, vars: Record<string, string | undefined> = {}): string {
  return template
    .replace(/\{(\w+)\}/g, (_, v: string) => (vars[v] ?? "").trim())
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+$/g, "")
    .trim();
}

/**
 * Text für den Kunden: eigene Fassung des Betriebs, sonst der Standard (bzw. `fallback`, z. B. der Standard passend zum
 * gewählten Tonfall). Leere eigene Fassung = Standard.
 */
export function customerText(own: Record<string, string> | undefined, key: string, vars: Record<string, string | undefined> = {}, fallback?: string): string {
  const custom = own?.[key]?.trim();
  // Ein einzelnes "-" schaltet den Text ab (z. B. keine Grußformel).
  if (custom === "-") return "";
  return fillText(custom || fallback || BY_KEY.get(key)?.default || "", vars);
}

/** Eigene Fassungen bereinigen: nur bekannte Schlüssel, nur echte Änderungen, begrenzte Länge. */
export function cleanTexts(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const def = BY_KEY.get(key);
    const v = value.replace(/\r\n/g, "\n").trim().slice(0, 1500);
    if (def && v && v !== def.default) out[key] = v === "–" ? "-" : v;
  }
  return out;
}

/** Beginnt der Text schon mit einer Anrede bzw. enthält er schon einen Gruß? Dann keinen zweiten anhängen. */
export const hasGreeting = (text: string) => /^\s*(guten (tag|morgen|abend)|hallo|hi\b|moin|servus|sehr geehrte|liebe[rs]?\b|grüß gott)/i.test(text);
export const hasSignoff = (text: string) => /(viele|beste|freundliche|herzliche|liebe)n? grüße|mit freundlichen grüßen|\bgruß\b|\bgrüße\b/i.test(text);
