import { describe, expect, it } from "vitest";
import type { AssistantSettings, Question } from "@/lib/data/types";
import { applyTurn, isInteractive, nextPending, parseAnswer, quickRepliesFor, SKIP_LABEL_OPTIONAL, SKIP_LABEL_REQUIRED, type TurnInput } from "./conversation";

const settings = (overrides: Partial<AssistantSettings> = {}): AssistantSettings => ({
  name: "Anna",
  greeting: "Hallo!",
  tone: "friendly",
  autoReply: true,
  autoFollowUp: true,
  appointmentBooking: true,
  humanHandoff: true,
  workingDays: [1, 2, 3, 4, 5],
  slotStart: "09:00",
  slotEnd: "17:00",
  slotMinutes: 60,
  maxAppointmentsPerDay: null,
  ...overrides,
});

const q = (overrides: Partial<Question> & Pick<Question, "key" | "label" | "prompt" | "type">): Question => ({
  id: overrides.key,
  companyId: "c1",
  options: [],
  required: true,
  active: true,
  position: 0,
  ...overrides,
});

const QUESTIONS: Question[] = [
  q({ key: "service", label: "Leistung", prompt: "Welche Leistung möchten Sie?", type: "choice", options: ["Energieberatung", "Sanierung", "Sonstiges"], position: 0 }),
  q({ key: "name", label: "Name", prompt: "Wie heißen Sie?", type: "text", position: 1 }),
  q({ key: "email", label: "E-Mail", prompt: "Ihre E-Mail?", type: "email", required: false, position: 2 }),
];

const turn = (overrides: Partial<TurnInput>): TurnInput => ({
  questions: QUESTIONS,
  settings: settings(),
  fields: {},
  text: "",
  ...overrides,
});

describe("parseAnswer", () => {
  const choiceQ = q({ key: "service", label: "Leistung", prompt: "?", type: "choice", options: ["Energieberatung", "Sanierung", "Sonstiges"] });
  const numberQ = q({ key: "yearBuilt", label: "Baujahr", prompt: "?", type: "number" });
  const floorsQ = q({ key: "floors", label: "Etagen", prompt: "?", type: "number" });
  const postalQ = q({ key: "postalCode", label: "PLZ", prompt: "?", type: "postal" });
  const emailQ = q({ key: "email", label: "E-Mail", prompt: "?", type: "email" });
  const phoneQ = q({ key: "phone", label: "Telefon", prompt: "?", type: "phone" });
  const textQ = q({ key: "name", label: "Name", prompt: "?", type: "text" });

  it("erkennt den Überspringen-Marker unabhängig vom Fragetyp", () => {
    expect(parseAnswer(numberQ, "weiß ich nicht")).toEqual({ ok: true, value: "—" });
    expect(parseAnswer(choiceQ, "-")).toEqual({ ok: true, value: "—" });
  });

  it("choice: direkte und über Stichworte erkannte Treffer", () => {
    expect(parseAnswer(choiceQ, "Energieberatung")).toEqual({ ok: true, value: "Energieberatung" });
    expect(parseAnswer(choiceQ, "Ich möchte sanieren")).toEqual({ ok: true, value: "Sanierung" });
  });

  it("choice: fällt bei kurzem Freitext auf 'Sonstiges' zurück, wenn vorhanden", () => {
    expect(parseAnswer(choiceQ, "Etwas anderes")).toEqual({ ok: true, value: "Sonstiges" });
  });

  it("choice: lehnt Rückfragen (mit '?') nicht als 'Sonstiges' ab", () => {
    expect(parseAnswer(choiceQ, "Was kostet das?")).toEqual({ ok: false });
  });

  it("number: akzeptiert Baujahr in plausiblem Bereich, lehnt Zukunft/zu alt ab", () => {
    expect(parseAnswer(numberQ, "1998")).toEqual({ ok: true, value: "1998" });
    expect(parseAnswer(numberQ, "Baujahr 1987")).toEqual({ ok: true, value: "1987" });
    expect(parseAnswer(numberQ, String(new Date().getFullYear() + 5))).toEqual({ ok: false });
    expect(parseAnswer(numberQ, "1500")).toEqual({ ok: false });
  });

  it("number: lehnt Text mit Zahl ab, der keine reine Angabe ist (z. B. eine Adresse)", () => {
    expect(parseAnswer(floorsQ, "Gartenweg 12")).toEqual({ ok: false });
  });

  it("postal: genau 5 Ziffern", () => {
    expect(parseAnswer(postalQ, "Ich wohne in 80331 München")).toEqual({ ok: true, value: "80331" });
    expect(parseAnswer(postalQ, "123")).toEqual({ ok: false });
  });

  it("email: erkennt gültige Adresse, lehnt ungültige ab", () => {
    expect(parseAnswer(emailQ, "Meine Adresse ist Max@Example.com")).toEqual({ ok: true, value: "max@example.com" });
    expect(parseAnswer(emailQ, "keine-email")).toEqual({ ok: false });
  });

  it("phone: akzeptiert plausible Telefonnummern", () => {
    expect(parseAnswer(phoneQ, "+49 170 1234567")).toEqual({ ok: true, value: "+49 170 1234567" });
    expect(parseAnswer(phoneQ, "12")).toEqual({ ok: false });
  });

  it("text: akzeptiert normale Antworten, lehnt zu kurze/lange ab", () => {
    expect(parseAnswer(textQ, "Max Mustermann")).toEqual({ ok: true, value: "Max Mustermann" });
    expect(parseAnswer(textQ, "a")).toEqual({ ok: false });
  });

  it("text: entfernt spitze Klammern (XSS-Vorsicht)", () => {
    expect(parseAnswer(textQ, "<script>Max</script>")).toEqual({ ok: true, value: "scriptMax/script" });
  });
});

describe("quickRepliesFor", () => {
  it("Pflichtfrage: Überspringen-Label ist 'Weiß ich nicht'", () => {
    const required = q({ key: "name", label: "Name", prompt: "?", type: "text", required: true });
    expect(quickRepliesFor(required)).toContain(SKIP_LABEL_REQUIRED);
  });

  it("optionale Frage: Überspringen-Label ist 'Überspringen'", () => {
    const optional = q({ key: "email", label: "E-Mail", prompt: "?", type: "email", required: false });
    expect(quickRepliesFor(optional)).toContain(SKIP_LABEL_OPTIONAL);
  });

  it("choice-Fragen listen zusätzlich die Optionen", () => {
    const choice = q({ key: "service", label: "Leistung", prompt: "?", type: "choice", options: ["A", "B"] });
    expect(quickRepliesFor(choice)).toEqual(["A", "B", SKIP_LABEL_REQUIRED]);
  });
});

describe("isInteractive", () => {
  it("Website-Chat und kein Kanal gelten als interaktiv, E-Mail/WhatsApp nicht", () => {
    expect(isInteractive(undefined)).toBe(true);
    expect(isInteractive("website")).toBe(true);
    expect(isInteractive("email")).toBe(false);
    expect(isInteractive("whatsapp")).toBe(false);
  });
});

describe("nextPending", () => {
  it("überspringt bereits beantwortete und irrelevante Fragen", () => {
    expect(nextPending(QUESTIONS, {})?.key).toBe("service");
    expect(nextPending(QUESTIONS, { service: "Energieberatung" })?.key).toBe("name");
    expect(nextPending(QUESTIONS, { service: "Energieberatung", name: "Max", email: "—" })).toBeNull();
  });
});

describe("applyTurn", () => {
  it("übernimmt bei der ersten Nachricht extrahierte Angaben und fragt die nächste fehlende ab", () => {
    const res = applyTurn(turn({ text: "Ich interessiere mich für eine Energieberatung", first: true, extracted: { service: "Energieberatung" } }));
    expect(res.fields.service).toBe("Energieberatung");
    expect(res.pendingKey).toBe("name");
    expect(res.recognizedKeys).toContain("service");
    expect(res.done).toBe(false);
  });

  it("Mitarbeiterwunsch behält bereits erkannte Angaben (Regressionstest für frueheren Bug)", () => {
    const res = applyTurn(
      turn({
        text: "Ich hätte gerne eine Energieberatung, bitte um Rückruf",
        first: true,
        extracted: { service: "Energieberatung" },
      }),
    );
    expect(res.handoff).toBe(true);
    expect(res.done).toBe(true);
    expect(res.fields.service).toBe("Energieberatung");
  });

  it("direkte Antwort auf eine Pflichtfrage rückt zur nächsten vor", () => {
    const res = applyTurn(turn({ fields: { service: "Energieberatung" }, text: "Max Mustermann" }));
    expect(res.fields.name).toBe("Max Mustermann");
    expect(res.pendingKey).toBe("email");
  });

  it("Korrektur überschreibt nur bereits beantwortete Felder bei ausdrücklichem Korrekturwunsch", () => {
    const res = applyTurn(
      turn({
        fields: { service: "Energieberatung", name: "Max" },
        text: "Korrektur, die Leistung ist eigentlich Sanierung",
        extracted: { service: "Sanierung" },
      }),
    );
    expect(res.fields.service).toBe("Sanierung");
    expect(res.recognizedKeys).toContain("service");
  });

  it("unverständliche Antwort ohne Extraktion fragt erneut, ohne das Feld zu setzen", () => {
    // 'service' ist eine choice-Frage – ein '?' schließt den 'Sonstiges'-Fallback aus, nichts matcht.
    const res = applyTurn(turn({ fields: {}, text: "xyz???" }));
    expect(res.fields.service).toBeUndefined();
    expect(res.pendingKey).toBe("service");
  });

  it("Überspringen einer Pflichtfrage setzt den SKIPPED-Marker, nicht 'beantwortet'", () => {
    const res = applyTurn(turn({ fields: { service: "Energieberatung" }, text: "weiß ich nicht" }));
    expect(res.fields.name).toBe("—");
    expect(res.pendingKey).toBe("email");
  });

  it("vollständiger Fall: 'done', Terminwunsch als Schnellantwort", () => {
    const res = applyTurn(turn({ fields: { service: "Energieberatung", name: "Max" }, text: "—" }));
    expect(res.done).toBe(true);
    expect(res.complete).toBe(true);
    expect(res.quickReplies).toContain("Termin wünschen");
  });

  it("Terminwunsch nach Vollständigkeit wird als appointmentRequested erkannt", () => {
    const res = applyTurn(turn({ fields: { service: "Energieberatung", name: "Max", email: "—" }, text: "Termin wünschen" }));
    expect(res.appointmentRequested).toBe(true);
    expect(res.done).toBe(true);
  });

  it("nicht-interaktiver Kanal fragt mehrere fehlende Angaben in einer Nachricht ab", () => {
    const res = applyTurn(turn({ text: "Hallo, ich habe eine Frage", first: true, channel: "email" }));
    expect(res.replies.some((r) => r.includes("Welche Leistung möchten Sie?") && r.includes("Wie heißen Sie?"))).toBe(true);
  });

  it("autoFollowUp aus: erste Nachricht endet sofort ohne weitere Rückfragen", () => {
    const res = applyTurn(turn({ settings: settings({ autoFollowUp: false }), text: "Hallo", first: true }));
    expect(res.done).toBe(true);
  });

  it("humanHandoff aus: Mitarbeiterwunsch löst keine Übergabe aus", () => {
    const res = applyTurn(turn({ settings: settings({ humanHandoff: false }), fields: { service: "Energieberatung" }, text: "Ich möchte mit einem Mitarbeiter sprechen" }));
    expect(res.handoff).toBe(false);
  });
});
