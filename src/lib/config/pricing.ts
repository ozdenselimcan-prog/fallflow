export interface Plan {
  id: "starter" | "pro" | "business";
  name: string;
  priceEur: number;
  caseLimit: number | null;
  highlighted?: boolean;
  /** Was diesen Plan ausmacht (Anfragen-Kontingent, Zusatzfunktionen) – auf der Preisseite hervorgehoben. */
  extras: string[];
  /** Alle Punkte des Plans: extras + die Funktionen, die jeder Plan hat. */
  features: string[];
}

/** In jedem Plan enthalten – überall vollständig aufgeführt, damit kein Plan "kleiner" wirkt. */
const COMMON_FEATURES = [
  "Automatische E-Mail-Antworten mit Ihren Texten & PDF-Vorlagen",
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
  plan({ id: "starter", name: "Starter", priceEur: 99, caseLimit: 100, extras: ["100 Kundenanfragen/Monat"] }),
  plan({
    id: "pro",
    name: "Pro",
    priceEur: 149,
    caseLimit: 500,
    highlighted: true,
    extras: ["500 Kundenanfragen/Monat", "KI-Voreinschätzung zum Fall", "Förder- & Bauteilwerte-Schätzung"],
  }),
  plan({
    id: "business",
    name: "Business",
    priceEur: 199,
    caseLimit: null,
    extras: ["Unbegrenzte Kundenanfragen", "KI-Voreinschätzung zum Fall", "Förder- & Bauteilwerte-Schätzung", "Prioritätssupport"],
  }),
];

/** Kleinunternehmerregelung: keine Umsatzsteuer. Fällt das weg, hier "zzgl. gesetzlicher MwSt." eintragen (und AGB § 5 anpassen). */
export const VAT_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";

export const getPlan = (id: string) => plans.find((p) => p.id === id) ?? plans[0];
