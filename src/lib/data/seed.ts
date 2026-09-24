import { buildSummary, computeCompleteness } from "@/lib/cases/completeness";
import { DEFAULT_ASSISTANT, DEFAULT_QUESTIONS } from "@/lib/cases/fields";
import type { Appointment, CaseEvent, CaseMessage, CaseRecord, Company, Member, Question } from "./types";

export const DEMO_COMPANY_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER_ID = "00000000-0000-4000-8000-0000000000a1";

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();
const inDays = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export function seedCompany(): Company {
  return {
    id: DEMO_COMPANY_ID,
    name: "BA Engineering & Consulting",
    website: "https://example.com",
    phone: "+49 89 000000",
    address: "Beispielstraße 1, 80331 München",
    services: ["Energieberatung", "iSFP", "Energieausweis", "Fördermittelberatung"],
    onboardingCompleted: true,
  };
}

export function seedQuestions(companyId = DEMO_COMPANY_ID): Question[] {
  return DEFAULT_QUESTIONS.map((q, i) => ({ ...q, id: `q-${i + 1}`, companyId, position: i }));
}

export const seedAssistant = () => ({ ...DEFAULT_ASSISTANT });

export function seedMembers(): Member[] {
  return [
    { id: "m-1", companyId: DEMO_COMPANY_ID, userId: DEMO_USER_ID, email: "max@example.com", name: "Max Mustermann", role: "OWNER", status: "active" },
    { id: "m-2", companyId: DEMO_COMPANY_ID, userId: "u-2", email: "sabine.keller@example.com", name: "Sabine Keller", role: "ADMIN", status: "active" },
    { id: "m-3", companyId: DEMO_COMPANY_ID, userId: null, email: "neu@example.com", name: "", role: "MEMBER", status: "invited" },
  ];
}

interface SeedCase {
  id: string;
  status: CaseRecord["status"];
  age: number;
  source: CaseRecord["source"];
  fields: Record<string, string>;
}

const seedCases: SeedCase[] = [
  {
    id: "c-1",
    status: "COMPLETE",
    age: 0,
    source: "widget",
    fields: {
      name: "Max Mustermann", email: "max.mustermann@example.com", phone: "+49 170 1234567", postalCode: "82166", buildingType: "Einfamilienhaus",
      yearBuilt: "1982", livingArea: "165", heating: "Gas", service: "iSFP", energySource: "Erdgas",
      description: "Hallo, ich möchte mein Haus sanieren und brauche einen iSFP.",
    },
  },
  {
    id: "c-2",
    status: "NEEDS_INFO",
    age: 1,
    source: "widget",
    fields: {
      name: "Anna Schmidt", email: "anna.schmidt@example.com", postalCode: "80999", buildingType: "Einfamilienhaus", yearBuilt: "1974",
      service: "Energieberatung", description: "Wir überlegen, die Fassade zu dämmen, und wollen wissen, was sinnvoll ist.",
    },
  },
  {
    id: "c-3",
    status: "COMPLETE",
    age: 2,
    source: "email",
    fields: {
      name: "Thomas Weber", email: "t.weber@example.com", phone: "+49 151 7654321", postalCode: "85221", buildingType: "Mehrfamilienhaus",
      yearBuilt: "1990", livingArea: "420", heating: "Öl", service: "Heizung", description: "Ölheizung ist in die Jahre gekommen, Austausch geplant.",
    },
  },
  {
    id: "c-4",
    status: "APPOINTMENT",
    age: 4,
    source: "widget",
    fields: {
      name: "Julia Fischer", email: "julia.fischer@example.com", phone: "+49 160 5556677", postalCode: "81675", buildingType: "Einfamilienhaus",
      yearBuilt: "1968", livingArea: "132", heating: "Fernwärme", service: "Energieausweis", description: "Energieausweis für den Verkauf des Hauses benötigt.",
    },
  },
  {
    id: "c-5",
    status: "NEW",
    age: 5,
    source: "whatsapp",
    fields: { name: "Michael Bauer", phone: "+49 172 9988776", postalCode: "83022", service: "Fördermittelberatung", description: "Welche Förderung gibt es für eine Wärmepumpe?" },
  },
];

export function seedCaseRecords(): CaseRecord[] {
  const questions = seedQuestions();
  return seedCases.map((c) => ({
    id: c.id,
    companyId: DEMO_COMPANY_ID,
    status: c.status,
    completeness: computeCompleteness(questions, c.fields),
    customerName: c.fields.name ?? "Unbekannt",
    service: c.fields.service ?? "",
    source: c.source,
    summary: buildSummary(c.fields),
    assignedTo: c.status === "APPOINTMENT" ? DEMO_USER_ID : null,
    createdAt: ago(c.age, 2),
    updatedAt: ago(c.age, 1),
    fields: c.fields,
  }));
}

export function seedEvents(): CaseEvent[] {
  const out: CaseEvent[] = [];
  let n = 0;
  for (const c of seedCases) {
    const add = (type: CaseEvent["type"], text: string, hoursAgo: number) =>
      out.push({ id: `e-${++n}`, caseId: c.id, type, text, createdAt: ago(c.age, hoursAgo) });
    add("received", "Anfrage eingegangen", 2);
    if (c.status !== "NEW") add("question", "KI hat Rückfrage gestellt", 1.8);
    if (c.status !== "NEW") add("answer", "Kunde hat geantwortet", 1.5);
    if (["COMPLETE", "CONTACTED", "APPOINTMENT"].includes(c.status)) add("complete", "Fall vollständig", 1.2);
  }
  return out;
}

export function seedMessages(): CaseMessage[] {
  return seedCases
    .filter((c) => c.fields.description)
    .flatMap((c, i) => [
      { id: `msg-${i}-1`, caseId: c.id, role: "user" as const, content: c.fields.description, createdAt: ago(c.age, 2) },
      { id: `msg-${i}-2`, caseId: c.id, role: "assistant" as const, content: "Gerne. Damit wir Ihre Anfrage vorbereiten können, benötigen wir noch einige Angaben.", createdAt: ago(c.age, 1.9) },
    ]);
}

export function seedAppointments(): Appointment[] {
  return [
    { id: "a-1", companyId: DEMO_COMPANY_ID, caseId: "c-4", title: "Erstgespräch Julia Fischer", startsAt: inDays(2, 10), durationMin: 45, notes: "Energieausweis, Unterlagen bereithalten" },
    { id: "a-2", companyId: DEMO_COMPANY_ID, caseId: "c-1", title: "Beratung Max Mustermann (iSFP)", startsAt: inDays(3, 14), durationMin: 60, notes: "" },
    { id: "a-3", companyId: DEMO_COMPANY_ID, caseId: null, title: "Vor-Ort-Termin Weber", startsAt: inDays(6, 9), durationMin: 90, notes: "MFH Neuburg" },
  ];
}
