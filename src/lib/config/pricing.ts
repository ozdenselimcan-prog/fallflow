export interface Plan {
  id: "starter" | "pro" | "business";
  name: string;
  priceEur: number;
  caseLimit: number | null;
  /** Inklusivminuten Telefon-Assistent pro Monat */
  phoneMinutes: number;
  highlighted?: boolean;
  /** Kostenlose Testphase möglich? Nur Starter – Pro und Business werden direkt abonniert. */
  trial: boolean;
  /** Was diesen Plan ausmacht (Anfragen-Kontingent, Zusatzfunktionen) – auf der Preisseite hervorgehoben. */
  extras: string[];
  /** Alle Punkte des Plans: extras + die Funktionen, die jeder Plan hat. */
  features: string[];
}

/** In jedem Plan enthalten – überall vollständig aufgeführt, damit kein Plan "kleiner" wirkt. */
const COMMON_FEATURES = [
  "Automatische E-Mail-Antworten mit Ihren Texten & PDF-Vorlagen",
  "WhatsApp-Anbindung (auch Sprachnachrichten)",
  "Website-Chat für Besucherfragen",
  "Fallakte mit Vollständigkeit in %",
  "Ausgefüllte PDFs werden automatisch ausgelesen",
  "Online-Terminbuchung & Terminerinnerungen",
  "Angebote als PDF mit KI-Entwurf",
  "Mehrere Mitarbeiter",
  "Monatlich kündbar",
];

const plan = (p: Omit<Plan, "features">): Plan => ({ ...p, features: [...p.extras, ...COMMON_FEATURES] });

/** Zentrale Preiskonfiguration – Landingpage und Billing lesen ausschließlich hieraus. */
export const plans: Plan[] = [
  plan({ id: "starter", name: "Starter", priceEur: 49, trial: true, caseLimit: 100, phoneMinutes: 0, extras: ["100 Kundenanfragen/Monat"] }),
  plan({
    id: "pro",
    name: "Pro",
    priceEur: 99,
    trial: false,
    caseLimit: 500,
    phoneMinutes: 120,
    highlighted: true,
    extras: ["500 Kundenanfragen/Monat", "Telefon-Assistent mit 120 Minuten/Monat (bald verfügbar)"],
  }),
  plan({
    id: "business",
    name: "Business",
    priceEur: 149,
    trial: false,
    caseLimit: null,
    phoneMinutes: 260,
    extras: ["Unbegrenzte Kundenanfragen", "Telefon-Assistent mit 240 Minuten/Monat + 20 Minuten geschenkt (bald verfügbar)", "Prioritätssupport"],
  }),
];

/** Kleinunternehmerregelung: keine Umsatzsteuer. Fällt das weg, hier "zzgl. gesetzlicher MwSt." eintragen (und AGB § 5 anpassen). */
export const VAT_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";

export const getPlan = (id: string) => plans.find((p) => p.id === id) ?? plans[0];

/** Darf dieser Plan kostenlos getestet werden? (nur Starter) */
export const planHasTrial = (id: string | undefined) => getPlan(id ?? "starter").trial;

/** Inklusivminuten des Plans (Telefon-Assistent); 0 = im Plan nicht enthalten (Starter). Danach nimmt die KI keine Anrufe mehr an – es gibt keine Zusatzminuten. */
export const phoneMinutesFor = (planId: string) => getPlan(planId).phoneMinutes;
