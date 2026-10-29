export interface Plan {
  id: "starter" | "pro" | "business";
  name: string;
  priceEur: number;
  caseLimit: number | null;
  /** Inklusivminuten Telefon-Assistent pro Monat */
  phoneMinutes: number;
  highlighted?: boolean;
  /** Was diesen Plan ausmacht (Anfragen-Kontingent, Zusatzfunktionen) – auf der Preisseite hervorgehoben. */
  extras: string[];
  /** Alle Punkte des Plans: extras + die Funktionen, die jeder Plan hat. */
  features: string[];
}

/** In jedem Plan enthalten – überall vollständig aufgeführt, damit kein Plan "kleiner" wirkt. */
const COMMON_FEATURES = [
  "Automatische E-Mail-Antworten mit Ihren Texten & PDF-Vorlagen",
  "Telefon-Assistent: KI nimmt Anrufe an und legt den Fall an",
  "Website-Chat für Besucherfragen",
  "Fallakte mit Vollständigkeit in %",
  "Ausgefüllte PDFs werden automatisch ausgelesen",
  "Terminvorschläge im Kalender",
  "Mehrere Mitarbeiter",
  "Monatlich kündbar",
];

const plan = (p: Omit<Plan, "features">): Plan => ({ ...p, features: [...p.extras, ...COMMON_FEATURES] });

/** Zentrale Preiskonfiguration – Landingpage und Billing lesen ausschließlich hieraus. */
export const plans: Plan[] = [
  plan({ id: "starter", name: "Starter", priceEur: 49, caseLimit: 100, phoneMinutes: 60, extras: ["100 Kundenanfragen/Monat", "60 Telefonminuten/Monat"] }),
  plan({
    id: "pro",
    name: "Pro",
    priceEur: 99,
    caseLimit: 500,
    phoneMinutes: 200,
    highlighted: true,
    extras: ["500 Kundenanfragen/Monat", "200 Telefonminuten/Monat"],
  }),
  plan({
    id: "business",
    name: "Business",
    priceEur: 149,
    caseLimit: null,
    phoneMinutes: 500,
    extras: ["Unbegrenzte Kundenanfragen", "500 Telefonminuten/Monat", "Prioritätssupport"],
  }),
];

/** Kleinunternehmerregelung: keine Umsatzsteuer. Fällt das weg, hier "zzgl. gesetzlicher MwSt." eintragen (und AGB § 5 anpassen). */
export const VAT_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";

export const getPlan = (id: string) => plans.find((p) => p.id === id) ?? plans[0];

/** Telefon-Assistent: Preis je Minute über dem Inklusivkontingent des Plans. */
export const PHONE_EXTRA_MINUTE_EUR = 0.39;
/** Inklusivminuten des Plans (Telefon-Assistent). */
export const phoneMinutesFor = (planId: string) => getPlan(planId).phoneMinutes;
