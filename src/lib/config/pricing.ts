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
    features: ["Automatische Mail-/Website-Antworten", "100 Kundenanfragen/Monat", "Fallakte mit Completeness Score", "Sicherer Dokumenten-Upload"],
  },
  {
    id: "pro",
    name: "Pro",
    priceEur: 149,
    caseLimit: 500,
    highlighted: true,
    features: ["500 Kundenanfragen/Monat", "KI-Voreinschätzung, Förder- & Bauteilwerte-Schätzung", "PDF-Vorlagen & Nachrichtentexte je Leistung", "Zentrale Inbox & automatische Follow-ups", "Mehrere Mitarbeiter"],
  },
  {
    id: "business",
    name: "Business",
    priceEur: 199,
    caseLimit: null,
    features: ["Unbegrenzte Kundenanfragen", "Alle Funktionen von Pro", "Mehrere Kanäle", "Prioritätssupport"],
  },
];

export const getPlan = (id: string) => plans.find((p) => p.id === id) ?? plans[0];
