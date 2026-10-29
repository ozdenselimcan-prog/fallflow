/* Inhalte des animierten Films (Server und Browser) – siehe case-film.tsx und industry-films.ts. */

/** Ein Beispiel-Fall für den Film – pro Branche eigene Inhalte (siehe industry-films.ts). */
export interface FilmScenario {
  customer: string;
  email: string;
  office: string;
  subject: string;
  /** Text der Kundenmail; mark 0…4 = Stellen, die die KI markiert (0 = Leistung) */
  mailParts: { text: string; mark?: number }[];
  reply: string;
  /** Leistung + vier erkannte Angaben (Reihenfolge wie die Markierungen 0…4) */
  fields: [string, string][];
  formFields: [string, string][];
  /** Drei Unterlagen in der Fallakte */
  docs: [string, string, string];
  /** Drei Anhänge in der Antwort des Kunden */
  attachments: [string, string, string];
  /** Name der PDF-Vorlage in der Antwort */
  template: string;
  /** Kurzbezeichnung der Leistung (Benachrichtigung, Betreff) */
  service: string;
  /** Text für Szene 2 ("… wandern automatisch in die Fallakte") */
  recognizes: string;
  question: { from: string; subject: string; text: string; ask: string };
}

export const DEFAULT_FILM: FilmScenario = {
  customer: "Erika Beispiel",
  email: "erika@beispiel.de",
  office: "Muster Bedachungen",
  subject: "Sturmschaden am Dach",
  mailParts: [
    { text: "Guten Tag, nach dem Sturm fehlen auf unserem " },
    { text: "Satteldach", mark: 1 },
    { text: " einige Ziegel, ca. " },
    { text: "10 m²", mark: 2 },
    { text: " sind betroffen, " },
    { text: "Wasser kommt noch nicht rein", mark: 3 },
    { text: ". Wir bitten um eine " },
    { text: "Dachreparatur", mark: 0 },
    { text: ". Lindenweg 7, " },
    { text: "82166 Gräfelfing", mark: 4 },
    { text: ". Viele Grüße, Erika Beispiel" },
  ],
  reply: "Vielen Dank für Ihre Anfrage zur Dachreparatur! Im Anhang finden Sie unser Auftragsformular – bitte ausgefüllt zurückschicken. Außerdem benötigen wir noch: Fotos vom Schaden und der Hausansicht.",
  fields: [
    ["Leistung", "Dachreparatur"],
    ["Dachform", "Satteldach"],
    ["Schadensfläche", "ca. 10 m²"],
    ["Wassereintritt", "nein"],
    ["PLZ", "82166"],
  ],
  formFields: [
    ["Adresse", "Lindenweg 7, 82166 Gräfelfing"],
    ["Aus dem Formular", "Zugang über Garten · Gerüst möglich"],
  ],
  docs: ["Auftragsformular", "Fotos vom Schaden", "Hausansicht"],
  attachments: ["Auftragsformular_ausgefuellt.pdf", "Schaden.jpg", "Hausansicht.jpg"],
  template: "Auftragsformular",
  service: "Dachreparatur",
  recognizes: "Leistung, Dach, Schadensfläche & Co. wandern automatisch in die Fallakte.",
  question: { from: "Max Muster", subject: "Dachfenster", text: "Hallo, wir möchten zwei Dachfenster einbauen lassen. ", ask: "Was kostet das bei Ihnen?" },
};
