import { beforeEach, describe, expect, it } from "vitest";
import { nextPending } from "@/lib/ai/conversation";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { confirmAppointment, receiveFilledTemplate, refreshCase } from "./case-ops";
import { CaseLimitReachedError, processIntakeMessage, type IntakeTurn } from "./engine";

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

  it("bucht während eines eingetragenen Urlaubszeitraums keinen Termin in dieser Zeit, sondern erst danach", async () => {
    const settings = await store.getAssistant();
    const toYmd = (d: Date) => d.toISOString().slice(0, 10);
    const from = toYmd(new Date());
    const until = toYmd(new Date(Date.now() + 3 * 86_400_000));
    await store.saveAssistant({ ...settings, vacationFrom: from, vacationUntil: until });

    await store.saveServiceMessage({ service: "Fördermittelberatung", body: "Danke für Ihre Anfrage, wir prüfen die Förderoptionen für Sie." });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich hätte gerne eine Fördermittelberatung.", source: "email", channel: "email" });

    const appointments = await store.listAppointments();
    const proposed = appointments.find((a) => a.caseId === first.sessionId && a.status === "proposed");
    expect(proposed).toBeDefined();
    expect(proposed!.startsAt.slice(0, 10) > until).toBe(true);
  });

  it("bucht per E-Mail automatisch den nächsten freien Termin, sobald der Fall laut Vorlagen & Nachrichten komplett ist – ohne den Kunden nach Wunschtagen zu fragen", async () => {
    await store.saveServiceMessage({ service: "Fördermittelberatung", body: "Danke für Ihre Anfrage, wir prüfen die Förderoptionen für Sie." });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich hätte gerne eine Fördermittelberatung.", source: "email", channel: "email" });
    const reply = first.replies.join(" ");
    expect(reply).toContain("Förderoptionen");
    expect(reply).not.toMatch(/welche tage|wochentage/i);
    expect(reply).toMatch(/Mitarbeiter/);

    const appointments = await store.listAppointments();
    expect(appointments.some((a) => a.caseId === first.sessionId && a.status === "proposed")).toBe(true);
  });

  it("schickt die Abschluss-Nachricht & bucht einen Termin, wenn die PDF-Vorlage NACH der ersten (bereits 'COMPLETE' markierten) E-Mail zurückkommt (Regressionstest)", async () => {
    // Bei E-Mail-Fällen wird der Status schon nach der ersten Nachricht "COMPLETE" (Frage-Flow-Felder zählen
    // dort nicht mehr), obwohl die Vorlage noch gar nicht zurück ist – das darf becamePrepared beim späteren
    // Übergang zu READY_FOR_REVIEW (Vorlage kommt an) nicht blockieren, siehe case-ops.ts PREPARED-Check.
    await store.saveServiceMessage({
      service: "Fördermittelberatung",
      body: "Danke für Ihre Anfrage, wir prüfen die Förderoptionen für Sie.",
      appointmentNote: "Vielen Dank, wir haben alles. Ein Mitarbeiter meldet sich zur Terminabstimmung.",
    });
    await store.saveDocumentTemplate({ service: "Fördermittelberatung", title: "Förderantrag", fileName: "antrag.pdf", storagePath: "demo/foerder.pdf" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich hätte gerne eine Fördermittelberatung.", source: "email", channel: "email" });
    expect((await store.getCase(first.sessionId))?.status).toBe("COMPLETE");

    await receiveFilledTemplate(store, first.sessionId, new Uint8Array([0x25, 0x50, 0x44, 0x46]), "antrag_ausgefuellt.pdf");

    const updated = await store.getCase(first.sessionId);
    expect(updated?.status).toBe("READY_FOR_REVIEW");
    const messages = await store.listMessages(first.sessionId);
    const lastText = messages.filter((m) => m.role === "assistant").at(-1)?.content ?? "";
    expect(lastText).toMatch(/Mitarbeiter/);
    const appointments = await store.listAppointments();
    expect(appointments.some((a) => a.caseId === first.sessionId && a.status === "proposed")).toBe(true);
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

describe("processIntakeMessage – PDF-Vorlagen (z. B. Vollmachten)", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("schickt im Website-Chat nur einen Download-Link mit (kein Upload-Link mehr), sobald die passende Leistung erkannt ist", async () => {
    const template = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht Energieberatung", fileName: "vollmacht.pdf", storagePath: "demo/templates/x.pdf" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    const reply = first.replies.join(" ");
    expect(reply).toContain(`/template/${template.id}`);
    expect(reply).not.toContain("wieder hoch");

    const templateDocs = await store.listTemplateDocuments(first.sessionId);
    expect(templateDocs).toHaveLength(1);
    expect(templateDocs[0]).toMatchObject({ templateId: template.id, status: "sent" });
  });

  it("schickt die Vorlage per E-Mail als Anhang statt als Link, ohne Upload-Hinweis", async () => {
    await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht Energieberatung", fileName: "vollmacht.pdf", storagePath: "demo/templates/x.pdf" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "email", channel: "email" });
    const reply = first.replies.join(" ");
    expect(reply).not.toContain("/template/");
    expect(reply).not.toContain("hochladen");
    expect(reply).toContain("Anhang");
  });

  it("eigene Nachricht wird auch ohne jede PDF-Vorlage fuer diese Leistung verschickt (einmalig)", async () => {
    await store.saveServiceMessage({ service: "Heizung", body: "Danke für Ihre Anfrage zum Hydraulischen Abgleich, wir melden uns." });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich möchte einen Heizung machen lassen.", source: "email", channel: "email" });
    expect(first.replies.join(" ")).toContain("wir melden uns");

    const second = await processIntakeMessage(store, { companyId: "demo", sessionId: first.sessionId, text: "Noch eine kurze Frage dazu.", source: "email", channel: "email" });
    expect(second.replies).toHaveLength(0);
  });

  it("per E-Mail wird NICHT nach fehlenden Angaben gefragt – nur die eigene Leistungs-Nachricht geht raus", async () => {
    await store.saveDocumentTemplate({ service: "iSFP", title: "iSFP-Vollmacht", fileName: "isfp.pdf", storagePath: "demo/templates/isfp.pdf" });
    await store.saveServiceMessage({ service: "iSFP", body: "Vielen Dank für Ihre Anfrage zum iSFP. Unser Team meldet sich in Kürze." });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich hätte gerne einen iSFP.", source: "email", channel: "email" });
    const reply = first.replies.join(" ");
    expect(reply).toContain("Unser Team meldet sich in Kürze");
    expect(reply).not.toContain("Welche Art Gebäude");
    expect(reply).not.toContain("fehlen mir noch ein paar Angaben");
    expect(reply).not.toContain("Gerne!");
  });

  it("per E-Mail ohne passende Leistungs-Vorlage/-Nachricht wird gar keine Mail verschickt", async () => {
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich hätte gerne eine Beratung, weiß aber nicht genau was.", source: "email", channel: "email" });
    expect(first.replies).toHaveLength(0);
  });

  it("per E-Mail wird die Abschluss-Nachricht verschickt, sobald der Fall vollständig ist", async () => {
    const questions = await store.listQuestions();
    let turn = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "email", channel: "email" });
    const sessionId = turn.sessionId;
    let pending = nextPending(questions, turn.fields);
    while (pending) {
      turn = await processIntakeMessage(store, { companyId: "demo", sessionId, text: ANSWERS[pending.key] ?? "unbekannt", source: "email", channel: "email" });
      pending = nextPending(questions, turn.fields);
    }
    expect(turn.done).toBe(true);
    expect(turn.replies.length).toBeGreaterThan(0);
    expect(turn.replies.join(" ")).toMatch(/Mitarbeiter|melde/);
  });

  it("schickt eine als 'bei jeder Anfrage' markierte Vorlage unabhängig von der erkannten Leistung mit", async () => {
    const always = await store.saveDocumentTemplate({ service: "", title: "Datenschutz-Einwilligung", fileName: "datenschutz.pdf", storagePath: "demo/templates/always.pdf", alwaysInclude: true });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    expect(first.replies.join(" ")).toContain(`/template/${always.id}`);
    const templateDocs = await store.listTemplateDocuments(first.sessionId);
    expect(templateDocs.map((t) => t.templateId)).toContain(always.id);
  });

  it("schickt eine passende Leistungs-Vorlage UND eine 'immer dabei'-Vorlage gemeinsam, nur einmal pro Vorlage", async () => {
    const serviceTemplate = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht Energieberatung", fileName: "vollmacht.pdf", storagePath: "demo/templates/x.pdf" });
    const always = await store.saveDocumentTemplate({ service: "", title: "Datenschutz-Einwilligung", fileName: "datenschutz.pdf", storagePath: "demo/templates/always.pdf", alwaysInclude: true });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    const sentIds = (await store.listTemplateDocuments(first.sessionId)).map((t) => t.templateId).sort();
    expect(sentIds).toEqual([always.id, serviceTemplate.id].sort());

    const second = await processIntakeMessage(store, { companyId: "demo", sessionId: first.sessionId, text: "Max Mustermann", source: "widget", channel: "website" });
    expect(second.replies.join(" ")).not.toContain("/template/");
  });

  it("schickt mehrere Vorlagen für dieselbe Leistung gemeinsam mit (z. B. zwei verschiedene Formulare)", async () => {
    const t1 = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht", fileName: "vollmacht.pdf", storagePath: "demo/templates/a.pdf" });
    const t2 = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Datenerfassungsblatt", fileName: "datenblatt.pdf", storagePath: "demo/templates/b.pdf" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    const sentIds = (await store.listTemplateDocuments(first.sessionId)).map((t) => t.templateId).sort();
    expect(sentIds).toEqual([t1.id, t2.id].sort());
    const reply = first.replies.join(" ");
    expect(reply).toContain(`/template/${t1.id}`);
    expect(reply).toContain(`/template/${t2.id}`);
  });

  it("schickt keinen Link ohne passende Vorlage", async () => {
    await store.saveDocumentTemplate({ service: "iSFP", title: "Vollmacht iSFP", fileName: "vollmacht-isfp.pdf", storagePath: "demo/templates/y.pdf" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    expect(first.replies.join(" ")).not.toContain("/template/");
  });

  it("schickt den Link nicht erneut bei Folgenachrichten derselben Unterhaltung", async () => {
    const template = await store.saveDocumentTemplate({ service: "Energieberatung", title: "Vollmacht Energieberatung", fileName: "vollmacht.pdf", storagePath: "demo/templates/x.pdf" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    const second = await processIntakeMessage(store, { companyId: "demo", sessionId: first.sessionId, text: "Max Mustermann", source: "widget", channel: "website" });
    expect(second.replies.join(" ")).not.toContain(`/template/${template.id}`);
  });

  it("Fall wird erst 'bereit zur Prüfung', wenn die ausgefüllte Vorlage zurück ist", async () => {
    // Fördermittelberatung verlangt standardmäßig weder Grundriss noch Energieausweis (siehe checklist.ts) –
    // damit ist die Vorlage hier das einzige noch offene Pflichtdokument, sauber isoliert vom Rest.
    const template = await store.saveDocumentTemplate({ service: "Fördermittelberatung", title: "EM-Vollmacht", fileName: "em-vollmacht.pdf", storagePath: "demo/templates/x.pdf" });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Fördermittelberatung.", source: "widget", channel: "website" });
    const sessionId = first.sessionId;
    const complete = await completeCase(store, sessionId, first);
    expect(complete.fields.service).toBe("Fördermittelberatung");

    // Alle Pflichtangaben liegen vor, die Vorlage aber noch nicht zurück → nicht fertig.
    expect(complete.status).not.toBe("READY_FOR_REVIEW");
    const [pending] = await store.listTemplateDocuments(sessionId);
    expect(pending.status).toBe("sent");

    await store.saveTemplateDocument({ id: pending.id, caseId: sessionId, templateId: template.id, status: "received", storagePath: "demo/x-filled.pdf", aiNote: "wirkt ausgefüllt", receivedAt: new Date().toISOString() });
    const refreshed = await refreshCase(store, sessionId, { hint: "edit" });
    expect(refreshed.caseRecord.status).toBe("READY_FOR_REVIEW");
  });
});

describe("processIntakeMessage – monatliches Fall-Limit", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("lehnt eine neue Anfrage ab, sobald das Fall-Limit des Plans (Demo-Store: Pro, 500/Monat) erreicht ist", async () => {
    for (let i = 0; i < 500; i++) {
      await store.createCase({ fields: {}, source: "manual", status: "NEW", customerName: "Bestand", service: "" });
    }
    await expect(
      processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" }),
    ).rejects.toThrow(CaseLimitReachedError);
  });

  it("lässt eine bereits laufende Unterhaltung unangetastet weiterlaufen, auch wenn das Limit zwischenzeitlich erreicht wurde", async () => {
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    for (let i = 0; i < 500; i++) {
      await store.createCase({ fields: {}, source: "manual", status: "NEW", customerName: "Bestand", service: "" });
    }
    // Folgenachricht desselben, bereits existierenden Falls darf nicht abgewiesen werden.
    const second = await processIntakeMessage(store, { companyId: "demo", sessionId: first.sessionId, text: "Max Mustermann", source: "widget", channel: "website" });
    expect(second.sessionId).toBe(first.sessionId);
  });
});

describe("processIntakeMessage – eigener Termin-Hinweis je Leistung", () => {
  let store: Store;
  beforeEach(() => {
    store = freshStore();
  });

  it("ersetzt die Standard-Formulierung durch den eigenen Text, sobald der Fall für diese Leistung fertig ist", async () => {
    await store.saveServiceMessage({ service: "Energieberatung", body: "", appointmentNote: "Unser Energieberater Herr Schmidt meldet sich binnen 24h bei Ihnen für einen Termin." });
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    const complete = await completeCase(store, first.sessionId, first);
    const combined = complete.replies.join(" | ");
    expect(combined).toContain("Unser Energieberater Herr Schmidt meldet sich binnen 24h bei Ihnen für einen Termin.");
    expect(combined).not.toContain("Ein Mitarbeiter meldet sich bei Ihnen");
  });

  it("nutzt die normale Standard-Formulierung, wenn kein eigener Termin-Hinweis gepflegt ist", async () => {
    const first = await processIntakeMessage(store, { companyId: "demo", sessionId: null, text: "Hallo, ich interessiere mich für eine Energieberatung.", source: "widget", channel: "website" });
    const complete = await completeCase(store, first.sessionId, first);
    expect(complete.replies.join(" | ")).toContain("Ein Mitarbeiter meldet sich bei Ihnen");
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
