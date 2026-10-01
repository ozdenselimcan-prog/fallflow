import { beforeEach, describe, expect, it } from "vitest";
import { nextPending } from "@/lib/ai/conversation";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { confirmAppointment } from "./case-ops";
import { processIntakeMessage, type IntakeTurn } from "./engine";

/**
 * Integrationstests über den echten In-Memory-Store (kein Supabase/KI-Key nötig – ohne AI_API_KEY
 * fällt die Extraktion automatisch auf den deterministischen Regel-Extraktor zurück, siehe heuristic.ts).
 * Jeder Test bekommt per beforeEach einen frisch geseedeten Store, da memory.ts einen Prozess-weiten
 * Singleton verwendet (globalThis.__fallflowDb).
 */
function freshStore(): Store {
  delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
  return createMemoryStore();
}

/** Literale Antworten je Fragen-Schlüssel – robust gegenüber dem (bewusst simplen) Regel-Extraktor. */
const ANSWERS: Record<string, string> = {
  service: "Energieberatung",
  buildingType: "Einfamilienhaus",
  yearBuilt: "1998",
  livingArea: "140",
  heating: "Gas",
  ownerStatus: "Eigentümer",
  street: "Musterstraße 1",
  postalCode: "80331",
  name: "Max Mustermann",
  email: "max@engine-test.de",
  phone: "+49 170 1234567",
};

/** Beantwortet nacheinander jede noch offene Pflichtfrage, bis der Fall vollständig ist. */
async function completeCase(store: Store, sessionId: string, turn: IntakeTurn): Promise<IntakeTurn> {
  const questions = await store.listQuestions();
  let pending = nextPending(questions, turn.fields);
  while (pending) {
    turn = await processIntakeMessage(store, { companyId: "demo", sessionId, text: ANSWERS[pending.key] ?? "unbekannt", source: "widget", channel: "website" });
    pending = nextPending(questions, turn.fields);
  }
  return turn;
}

/** Treibt eine Unterhaltung bis zu einem vorgeschlagenen (noch nicht freigegebenen) Termin. */
async function createCaseWithProposedAppointment(store: Store) {
  const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
  const sessionId = first.sessionId;
  const complete = await completeCase(store, sessionId, first);
  const availability = await processIntakeMessage(store, { companyId: "demo", sessionId, text: "Montag bis Freitag", source: "widget", channel: "website" });
  return { sessionId, turns: [first, complete, availability] };
}

describe("processIntakeMessage – Terminvorschlag", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("schlägt einen Termin vor, ohne dem Kunden das Datum zu verraten", async () => {
    const { sessionId, turns } = await createCaseWithProposedAppointment(store);
    const lastReply = turns[2].replies.join(" ");
    expect(lastReply).not.toMatch(/\d{1,2}:\d{2}|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag/i);
    expect(lastReply).toMatch(/Mitarbeiter/);

    const appointments = await store.listAppointments();
    const proposed = appointments.find((a) => a.caseId === sessionId && a.status === "proposed");
    expect(proposed).toBeDefined();
  });

  it("legt keinen Termin an, solange noch Pflichtangaben fehlen", async () => {
    const t1 = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    const appointments = await store.listAppointments();
    expect(appointments.some((a) => a.caseId === t1.sessionId)).toBe(false);
  });
});

describe("processIntakeMessage – eigenes Kontaktformular", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("schickt den Formular-Link bei der ersten Nachricht mit, wenn das Büro einen hinterlegt hat", async () => {
    await store.updateCompany({ contactFormUrl: "https://buero-beispiel.de/kontakt" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    expect(first.replies[0]).toContain("https://buero-beispiel.de/kontakt");
  });

  it("schickt keinen Link, wenn kein Formular hinterlegt ist", async () => {
    await store.updateCompany({ contactFormUrl: "" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    expect(first.replies.join(" ")).not.toContain("http");
  });

  it("schickt den Link nicht erneut bei Folgenachrichten derselben Unterhaltung", async () => {
    await store.updateCompany({ contactFormUrl: "https://buero-beispiel.de/kontakt" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    const second = await processIntakeMessage(store, { companyId: "demo", sessionId: first.sessionId, text: "Energieberatung", source: "widget", channel: "website" });
    expect(second.replies.join(" ")).not.toContain("buero-beispiel.de");
  });
});

describe("confirmAppointment", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("akzeptiert einen Vorschlag unverändert und markiert den Fall als bestätigt", async () => {
    const { sessionId } = await createCaseWithProposedAppointment(store);
    const proposed = (await store.listAppointments()).find((a) => a.caseId === sessionId)!;

    const result = await confirmAppointment(store, proposed.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointment.status).toBe("confirmed");
    expect(result.appointment.startsAt).toBe(proposed.startsAt);

    const updatedCase = await store.getCase(sessionId);
    expect(updatedCase?.fields.apptStage).toBe("confirmed");

    const messages = await store.listMessages(sessionId);
    expect(messages.some((m) => m.role === "staff" && m.content.includes("Termin bestätigt"))).toBe(true);
  });

  it("legt bei Ablehnung einen vom Team gewählten, abweichenden Termin fest", async () => {
    const { sessionId } = await createCaseWithProposedAppointment(store);
    const proposed = (await store.listAppointments()).find((a) => a.caseId === sessionId)!;
    const proposedId = proposed.id;
    // In primitive Werte kopieren: der Memory-Store liefert dieselbe Objektreferenz zurück, die
    // confirmAppointment gleich darauf in-place mutiert – sonst würde sich "proposed" live mitändern.
    const originalStartsAt = String(proposed.startsAt);
    // Bewusst relativ zum vorgeschlagenen Termin versetzt, damit es nie zufällig mit ihm zusammenfällt.
    const customDate = new Date(new Date(originalStartsAt).getTime() + 10 * 86_400_000).toISOString();

    const result = await confirmAppointment(store, proposedId, customDate);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appointment.status).toBe("confirmed");
    expect(result.appointment.startsAt).toBe(customDate);
    expect(result.appointment.startsAt).not.toBe(originalStartsAt);
  });

  it("meldet einen Fehler für einen unbekannten Termin", async () => {
    const result = await confirmAppointment(store, "does-not-exist");
    expect(result).toEqual({ ok: false, status: 404, message: "Termin nicht gefunden" });
  });
});

describe("processIntakeMessage – Absage durch den Kunden", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("storniert einen bestätigten Termin und schlägt sofort einen neuen vor, wenn der Kunde direkt ein neues Datum nennt", async () => {
    const { sessionId } = await createCaseWithProposedAppointment(store);
    const proposed = (await store.listAppointments()).find((a) => a.caseId === sessionId)!;
    await confirmAppointment(store, proposed.id);

    const turn = await processIntakeMessage(store, {
      companyId: "demo",
      sessionId,
      text: "Ich muss den Termin leider absagen. Könnten wir stattdessen Montag machen?",
      source: "widget",
      channel: "website",
    });

    const appointments = await store.listAppointments();
    const forCase = appointments.filter((a) => a.caseId === sessionId);
    expect(forCase).toHaveLength(1);
    expect(forCase[0].status).toBe("proposed");
    expect(forCase[0].id).not.toBe(proposed.id);
    expect(turn.replies.join(" ")).toMatch(/storniert/);
  });

  it("storniert einen bestätigten Termin und fragt nach, wenn der Kunde keinen neuen Wunsch nennt", async () => {
    const { sessionId } = await createCaseWithProposedAppointment(store);
    const proposed = (await store.listAppointments()).find((a) => a.caseId === sessionId)!;
    await confirmAppointment(store, proposed.id);

    const turn = await processIntakeMessage(store, {
      companyId: "demo",
      sessionId,
      text: "Ich muss den Termin leider absagen.",
      source: "widget",
      channel: "website",
    });

    const appointments = await store.listAppointments();
    expect(appointments.some((a) => a.caseId === sessionId)).toBe(false);
    expect(turn.replies.join(" ")).toMatch(/storniert/);
  });

  it("ignoriert eine Absage ohne vorherigen bestätigten Termin", async () => {
    const { sessionId } = await createCaseWithProposedAppointment(store);
    // Noch nichts akzeptiert – nur ein "proposed"-Termin existiert, kein "confirmed".
    const before = (await store.listAppointments()).filter((a) => a.caseId === sessionId);

    await processIntakeMessage(store, { companyId: "demo", sessionId, text: "Ich muss leider absagen.", source: "widget", channel: "website" });

    const after = (await store.listAppointments()).filter((a) => a.caseId === sessionId);
    expect(after).toEqual(before);
  });
});
