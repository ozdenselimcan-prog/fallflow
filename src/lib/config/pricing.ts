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
    priceEur: 29,
    caseLimit: 100,
    features: ["Website-Chat", "100 Fälle/Monat", "Automatische Rückfragen", "Beratungsfall-Dashboard"],
  },
  {
    id: "pro",
    name: "Pro",
    priceEur: 59,
    caseLimit: 500,
    highlighted: true,
    features: ["500 Fälle/Monat", "E-Mail", "Terminübergabe", "Mehrere Mitarbeiter", "Individuelle Fragen"],
  },
  {
    id: "business",
    name: "Business",
    priceEur: 99,
    caseLimit: null,
    features: ["Unbegrenzte Fälle", "Mehrere Kanäle", "Individuelle Workflows", "Prioritätssupport"],
  },
];

export const getPlan = (id: string) => plans.find((p) => p.id === id) ?? plans[0];
