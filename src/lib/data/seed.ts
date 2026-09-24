import { buildSummary } from "@/lib/cases/completeness";
import { DEFAULT_ASSISTANT, DEFAULT_QUESTIONS } from "@/lib/cases/fields";
import { buildChecklist } from "@/lib/intake/checklist";
import { documentRequestMessage, infoReminderMessage } from "@/lib/intake/messages";
import type {
  Appointment,
  CaseDocument,
  CaseEvent,
  CaseMessage,
  CaseRecord,
  CaseStatus,
  Company,
  DocumentKind,
  FollowUp,
  Member,
  MessageChannel,
  Question,
} from "./types";

export const DEMO_COMPANY_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_USER_ID = "00000000-0000-4000-8000-0000000000a1";

const ago = (days: number, hours = 0, minutes = 0) => new Date(Date.now() - days * 86_400_000 - hours * 3_600_000 - minutes * 60_000).toISOString();
const inDays = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const uploadUrl = (token: string) => `${APP_URL}/upload/${token}`;

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

interface SeedDoc {
  kind: DocumentKind;
  status: "requested" | "received";
  fileName?: string;
}

interface SeedCase {
  id: string;
  status: CaseStatus;
  /** Alter des Falls */
  age: { days: number; hours?: number; minutes?: number };
  /** Minuten seit der letzten Aktivität */
  idleMin: number;
  source: CaseRecord["source"];
  channel: MessageChannel;
  token?: string;
  fields: Record<string, string>;
  docs?: SeedDoc[];
  /** Ereignisse (Reihenfolge = zeitlich aufsteigend) */
  events: { type: CaseEvent["type"]; text: string }[];
  /** Weitere Nachrichten nach der Erstanfrage */
  chat?: { role: CaseMessage["role"]; content: string }[];
}

const seedCases: SeedCase[] = [
  {
    id: "c-1",
    status: "READY_FOR_REVIEW",
    age: { days: 0, hours: 3 },
    idleMin: 40,
    source: "widget",
    channel: "website",
    token: "demo-upload-mustermann",
    fields: {
      name: "Max Mustermann",
      email: "max.mustermann@example.com",
      phone: "+49 170 1234567",
      street: "Gartenweg 12",
      postalCode: "82166",
      ownerStatus: "Eigentümer",
      buildingType: "Einfamilienhaus",
      yearBuilt: "1987",
      livingArea: "160",
      floors: "2",
      heating: "Gas",
      energySource: "Erdgas",
      service: "iSFP",
      priority: "Normal",
      description: "Hallo, wir haben ein Einfamilienhaus von 1987 mit 160 qm und möchten einen iSFP.",
    },
    docs: [
      { kind: "energy_certificate", status: "received", fileName: "Energieausweis_Mustermann.pdf" },
      { kind: "floorplan", status: "requested" },
    ],
    events: [
      { type: "received", text: "Anfrage über den Website-Chat eingegangen" },
      { type: "answer", text: "KI hat Gebäudetyp, Baujahr, Wohnfläche und Leistung erkannt" },
      { type: "question", text: "KI hat fehlende Angaben abgefragt" },
      { type: "document", text: "Dokument angefordert: Grundriss" },
      { type: "prepared", text: "Fall automatisch vorbereitet" },
    ],
    chat: [
      { role: "assistant", content: "Gerne! Das habe ich schon verstanden: Gebäudetyp Einfamilienhaus, Baujahr 1987, Wohnfläche 160 m², Gewünschte Leistung iSFP." },
      { role: "assistant", content: "Sind Sie Eigentümer, Mieter oder Verwalter des Gebäudes?" },
      { role: "user", content: "Eigentümer" },
      { role: "assistant", content: "Vielen Dank, damit habe ich alle Angaben. Zur Vorbereitung Ihres Termins benötigen wir außerdem noch den Grundriss." },
    ],
  },
  {
    id: "c-2",
    status: "QUALIFYING",
    age: { days: 0, minutes: 12 },
    idleMin: 3,
    source: "widget",
    channel: "website",
    fields: {
      name: "Anna Schmidt",
      email: "anna.schmidt@example.com",
      postalCode: "80999",
      buildingType: "Einfamilienhaus",
      yearBuilt: "1974",
      service: "Energieberatung",
      description: "Wir überlegen, die Fassade zu dämmen, und wollen wissen, was sinnvoll ist.",
    },
    events: [
      { type: "received", text: "Anfrage über den Website-Chat eingegangen" },
      { type: "question", text: "KI hat fehlende Angaben abgefragt" },
    ],
    chat: [
      { role: "assistant", content: "Gerne! Das habe ich schon verstanden: Gewünschte Leistung Energieberatung." },
      { role: "assistant", content: "Welche Art Gebäude ist es?" },
      { role: "user", content: "Einfamilienhaus, Baujahr 1974" },
      { role: "assistant", content: "Notiert: Baujahr 1974. Wie groß ist die Wohnfläche in m²?" },
    ],
  },
  {
    id: "c-3",
    status: "WAITING_FOR_CUSTOMER",
    age: { days: 2, hours: 1 },
    idleMin: 60 * 26,
    source: "email",
    channel: "email",
    token: "demo-upload-weber",
    fields: {
      name: "Thomas Weber",
      email: "t.weber@example.com",
      phone: "+49 151 7654321",
      street: "Industrieweg 4",
      postalCode: "85221",
      buildingType: "Mehrfamilienhaus",
      yearBuilt: "1990",
      livingArea: "420",
      floors: "4",
      heating: "Öl",
      energySource: "Heizöl",
      service: "Heizung",
      priority: "Hoch",
      description: "Unsere Ölheizung ist in die Jahre gekommen, ein Austausch ist geplant.",
    },
    docs: [
      { kind: "floorplan", status: "requested" },
      { kind: "energy_certificate", status: "requested" },
    ],
    events: [
      { type: "received", text: "Anfrage per E-Mail eingegangen" },
      { type: "answer", text: "KI hat Baujahr, Wohnfläche, Heizung und Leistung erkannt" },
      { type: "question", text: "KI hat fehlende Angaben abgefragt" },
      { type: "document", text: "Dokumente angefordert: Grundriss, Energieausweis" },
      { type: "followup", text: "Follow-up geplant" },
    ],
    chat: [
      { role: "assistant", content: "Vielen Dank für Ihre Anfrage. Damit wir Ihren Fall vorbereiten können, fehlen noch: Eigentümerstatus. Sind Sie Eigentümer, Mieter oder Verwalter?" },
    ],
  },
  {
    id: "c-4",
    status: "READY_FOR_REVIEW",
    age: { days: 4 },
    idleMin: 60 * 24 * 3,
    source: "widget",
    channel: "website",
    fields: {
      name: "Julia Fischer",
      email: "julia.fischer@example.com",
      phone: "+49 160 5556677",
      street: "Lindenallee 5",
      postalCode: "81675",
      ownerStatus: "Eigentümer",
      buildingType: "Einfamilienhaus",
      yearBuilt: "1968",
      livingArea: "132",
      floors: "2",
      heating: "Fernwärme",
      energySource: "Fernwärme",
      service: "Energieausweis",
      priority: "Normal",
      description: "Energieausweis für den Verkauf des Hauses benötigt.",
    },
    docs: [{ kind: "floorplan", status: "received", fileName: "Grundriss_Fischer.pdf" }],
    events: [
      { type: "received", text: "Anfrage über den Website-Chat eingegangen" },
      { type: "question", text: "KI hat fehlende Angaben abgefragt" },
      { type: "document", text: "Dokument erhalten: Grundriss" },
      { type: "prepared", text: "Fall automatisch vorbereitet" },
      { type: "appointment", text: "Termin vorgeschlagen" },
    ],
  },
  {
    id: "c-5",
    status: "QUALIFYING",
    age: { days: 0, minutes: 25 },
    idleMin: 8,
    source: "whatsapp",
    channel: "whatsapp",
    fields: {
      name: "Michael Bauer",
      phone: "+49 172 9988776",
      postalCode: "83022",
      service: "Fördermittelberatung",
      description: "Welche Förderung gibt es für eine Wärmepumpe?",
    },
    events: [
      { type: "received", text: "Anfrage per WhatsApp eingegangen (Demo-Simulation)" },
      { type: "question", text: "KI hat fehlende Angaben abgefragt" },
    ],
    chat: [
      { role: "assistant", content: "Dazu meldet sich gerne unser Team persönlich bei Ihnen. Ich sammle zunächst die Angaben für Ihren Fall. Welche Art Gebäude ist es?" },
    ],
  },
  {
    id: "c-6",
    status: "NEW",
    age: { days: 0, minutes: 6 },
    idleMin: 2,
    source: "widget",
    channel: "website",
    fields: {
      name: "Lena Hoffmann",
      email: "lena.hoffmann@example.com",
      description: "Guten Tag, wir möchten unser Haus energetisch sanieren. Können Sie uns dazu beraten?",
      service: "Sanierung",
    },
    events: [{ type: "received", text: "Anfrage über den Website-Chat eingegangen" }],
  },
  {
    id: "c-7",
    status: "CONVERTED",
    age: { days: 6 },
    idleMin: 60 * 24 * 5,
    source: "widget",
    channel: "website",
    fields: {
      name: "Familie Koch",
      email: "koch@example.com",
      phone: "+49 176 4411223",
      street: "Waldstraße 21",
      postalCode: "85049",
      ownerStatus: "Eigentümer",
      buildingType: "Einfamilienhaus",
      yearBuilt: "1979",
      livingArea: "148",
      floors: "2",
      heating: "Öl",
      energySource: "Heizöl",
      service: "iSFP",
      priority: "Normal",
      description: "Wir möchten einen Sanierungsfahrplan für unser Haus.",
    },
    docs: [
      { kind: "floorplan", status: "received", fileName: "Grundriss_Koch.pdf" },
      { kind: "energy_certificate", status: "received", fileName: "Energieausweis_Koch.pdf" },
    ],
    events: [
      { type: "received", text: "Anfrage über den Website-Chat eingegangen" },
      { type: "prepared", text: "Fall automatisch vorbereitet" },
      { type: "status", text: "Status: Übernommen" },
    ],
  },
];

const docsOf = (c: SeedCase): CaseDocument[] =>
  (c.docs ?? []).map((d, i) => ({
    id: `d-${c.id}-${i}`,
    caseId: c.id,
    companyId: DEMO_COMPANY_ID,
    kind: d.kind,
    status: d.status,
    fileName: d.fileName ?? "",
    mimeType: d.status === "received" ? "application/pdf" : "",
    size: 0,
    storagePath: "",
    requestedAt: ago(c.age.days, (c.age.hours ?? 0) - 0.5),
    receivedAt: d.status === "received" ? ago(c.age.days, (c.age.hours ?? 0) - 1) : null,
  }));

export function seedDocuments(): CaseDocument[] {
  return seedCases.flatMap(docsOf);
}

export function seedCaseRecords(): CaseRecord[] {
  const questions = seedQuestions();
  return seedCases.map((c) => {
    const checklist = buildChecklist({ questions, fields: c.fields, documents: docsOf(c) });
    return {
      id: c.id,
      companyId: DEMO_COMPANY_ID,
      status: c.status,
      completeness: checklist.percent,
      customerName: c.fields.name ?? "Unbekannt",
      service: c.fields.service ?? "",
      source: c.source,
      summary: c.fields.buildingType ? buildSummary(c.fields) : "",
      assignedTo: c.status === "CONVERTED" ? DEMO_USER_ID : null,
      createdAt: ago(c.age.days, c.age.hours ?? 0, c.age.minutes ?? 0),
      updatedAt: ago(0, 0, c.idleMin),
      fields: c.fields,
      uploadToken: c.token ?? null,
      uploadTokenExpiresAt: c.token ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
    };
  });
}

export function seedEvents(): CaseEvent[] {
  const out: CaseEvent[] = [];
  let n = 0;
  for (const c of seedCases) {
    const created = Date.now() - c.age.days * 86_400_000 - (c.age.hours ?? 0) * 3_600_000 - (c.age.minutes ?? 0) * 60_000;
    c.events.forEach((e, i) => out.push({ id: `e-${++n}`, caseId: c.id, type: e.type, text: e.text, createdAt: new Date(created + i * 90_000).toISOString() }));
  }
  return out;
}

export function seedMessages(): CaseMessage[] {
  const out: CaseMessage[] = [];
  let n = 0;
  for (const c of seedCases) {
    const created = Date.now() - c.age.days * 86_400_000 - (c.age.hours ?? 0) * 3_600_000 - (c.age.minutes ?? 0) * 60_000;
    const at = (i: number) => new Date(created + i * 60_000).toISOString();
    const simulated = c.channel === "whatsapp";
    const lines: { role: CaseMessage["role"]; content: string }[] = [
      ...(c.fields.description ? [{ role: "user" as const, content: c.fields.description }] : []),
      ...(c.chat ?? []),
    ];
    lines.forEach((m, i) =>
      out.push({
        id: `msg-${++n}`,
        caseId: c.id,
        role: m.role,
        content: m.content,
        createdAt: at(i),
        channel: c.channel,
        // Simulierte WhatsApp-/E-Mail-Antworten der KI wurden nie über einen echten Kanal versendet.
        delivery: m.role === "assistant" && c.channel !== "website" ? "not_sent" : "delivered",
        simulated: simulated && c.channel !== "website",
      }),
    );
  }
  out.push({
    id: `msg-${++n}`,
    caseId: "c-7",
    role: "staff",
    content: "Telefonat mit Familie Koch: Grundriss und Energieausweis liegen vor, Vor-Ort-Termin vereinbart.",
    createdAt: ago(5, 3),
    channel: "phone",
    delivery: "internal",
    simulated: false,
  });
  return out;
}

export function seedAppointments(): Appointment[] {
  return [
    { id: "a-1", companyId: DEMO_COMPANY_ID, caseId: "c-4", title: "Erstgespräch Julia Fischer", startsAt: inDays(2, 10), durationMin: 45, notes: "Energieausweis, Unterlagen bereithalten", status: "proposed" },
    { id: "a-2", companyId: DEMO_COMPANY_ID, caseId: "c-7", title: "Vor-Ort-Termin Familie Koch (iSFP)", startsAt: inDays(0, 16), durationMin: 90, notes: "Waldstraße 21", status: "confirmed" },
    { id: "a-3", companyId: DEMO_COMPANY_ID, caseId: null, title: "Vor-Ort-Termin Weber", startsAt: inDays(6, 9), durationMin: 90, notes: "MFH Neuburg", status: "confirmed" },
  ];
}

export function seedFollowUps(): FollowUp[] {
  const weber = seedCases.find((c) => c.id === "c-3")!;
  const mustermann = seedCases.find((c) => c.id === "c-1")!;
  return [
    {
      id: "f-1",
      caseId: "c-3",
      companyId: DEMO_COMPANY_ID,
      kind: "document",
      message: documentRequestMessage({ name: weber.fields.name, kinds: ["floorplan", "energy_certificate"], url: uploadUrl(weber.token!), reminder: true }),
      scheduledFor: inDays(1, 9),
      status: "planned",
      sentAt: null,
      note: "",
      createdAt: ago(1, 20),
    },
    {
      id: "f-2",
      caseId: "c-1",
      companyId: DEMO_COMPANY_ID,
      kind: "document",
      message: documentRequestMessage({ name: mustermann.fields.name, kinds: ["floorplan"], url: uploadUrl(mustermann.token!), reminder: true }),
      scheduledFor: inDays(2, 9),
      status: "planned",
      sentAt: null,
      note: "",
      createdAt: ago(0, 2),
    },
    {
      id: "f-3",
      caseId: "c-2",
      companyId: DEMO_COMPANY_ID,
      kind: "info",
      message: infoReminderMessage({ name: "Anna Schmidt", missing: ["Wohnfläche", "Heizung", "Eigentümerstatus", "Straße", "Telefonnummer"] }),
      scheduledFor: inDays(1, 9),
      status: "planned",
      sentAt: null,
      note: "",
      createdAt: ago(0, 0, 10),
    },
  ];
}
