export interface Plan {
  id: "starter" | "pro" | "business";
  name: string;
  priceEur: number;
  caseLimit: number | null;
  highlighted?: boolean;
  features: string[];
}

/** Zentrale Preiskonfiguration – Landingpage und Billing lesen ausschließlich hieraus. */
export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceEur: 99,
    caseLimit: 100,
    features: [
      "100 Kundenanfragen/Monat",
      "Automatische E-Mail-Antworten mit Ihren Texten & PDF-Vorlagen",
      "Website-Chat für Besucherfragen",
      "Fallakte mit Vollständigkeit in %",
      "Ausgefüllte PDFs werden automatisch ausgelesen",
      "Mehrere Mitarbeiter",
      "Monatlich kündbar",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceEur: 149,
    caseLimit: 500,
    highlighted: true,
    features: [
      "500 Kundenanfragen/Monat",
      "Alle Funktionen von Starter",
      "KI-Voreinschätzung, Förder- & Bauteilwerte-Schätzung",
      "Monatlich kündbar",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceEur: 199,
    caseLimit: null,
    features: ["Unbegrenzte Kundenanfragen", "Alle Funktionen von Pro", "Prioritätssupport", "Monatlich kündbar"],
  },
];

/** Kleinunternehmerregelung: keine Umsatzsteuer. Fällt das weg, hier "zzgl. gesetzlicher MwSt." eintragen (und AGB § 5 anpassen). */
export const VAT_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";

export const getPlan = (id: string) => plans.find((p) => p.id === id) ?? plans[0];
