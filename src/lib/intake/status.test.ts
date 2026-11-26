import { beforeEach, describe, expect, it } from "vitest";
import { businessFacts } from "@/lib/ai/knowledge";
import { customerText } from "@/lib/config/customer-texts";
import { createMemoryStore } from "@/lib/data/memory";
import type { Store } from "@/lib/data/store";
import { processIntakeMessage } from "./engine";
import { statusAnswer, statusQuestion } from "./status";

const T = (key: string, vars: Record<string, string> = {}) => customerText(undefined, key, vars);

describe("Frage nach dem Stand erkennen", () => {
  it.each([
    "Wann kommen Sie denn?",
    "Wie ist der Stand?",
    "Gibt es schon etwas Neues?",
    "Haben Sie meine Fotos erhalten?",
    "Ist meine Mail angekommen?",
    "Wann melden Sie sich?",
    "Steht der Termin noch?",
    "Ich warte immer noch auf eine Antwort.",
    "Ich habe noch nichts von Ihnen gehört.",
  ])("„%s“ = Frage nach dem Stand", (text) => {
    expect(statusQuestion(text).asked).toBe(true);
  });

  it.each(["Wann hätten Sie Zeit für einen Termin?", "Was kostet das?", "Ich möchte den Termin verschieben.", "Wie ist der Stand mit dem Preis?", "Anbei die Fotos."])(
    "„%s“ = keine Frage nach dem Stand",
    (text) => {
      expect(statusQuestion(text).asked).toBe(false);
    },
  );

  it("andere Sätze bleiben übrig (für weitere Fragen)", () => {
    const { asked, rest } = statusQuestion("Haben Sie meine Fotos bekommen? Und was kostet das ungefähr?");
    expect(asked).toBe(true);
    expect(rest).toBe("Und was kostet das ungefähr?");
  });
});

describe("Antwort auf die Frage nach dem Stand", () => {
  const now = Date.parse("2026-12-01T08:00:00Z");
  it("bestätigter Termin: Datum und Uhrzeit", () => {
    const text = statusAnswer({ appointments: [{ startsAt: "2026-12-03T09:00:00Z", status: "confirmed" }], missing: [], T, now });
    expect(text).toContain("Ihr Termin steht: Donnerstag, 03.12. um 10:00 Uhr");
  });
  it("Termin wartet auf Bestätigung", () => {
    expect(statusAnswer({ appointments: [{ startsAt: "2026-12-03T09:00:00Z", status: "proposed" }], missing: [], T, now })).toContain("Bestätigung");
  });
  it("vergangene Termine zählen nicht", () => {
    expect(statusAnswer({ appointments: [{ startsAt: "2026-11-20T09:00:00Z", status: "confirmed" }], missing: [], T, now })).toContain("vollständig vor");
  });
  it("es fehlt noch etwas: Liste und Upload-Link", () => {
    const text = statusAnswer({ appointments: [], missing: [{ label: "Adresse" }, { label: "Fotos vom Dach" }], uploadLink: "https://x/upload/abc", T, now });
    expect(text).toContain("fehlt uns noch: Adresse, Fotos vom Dach.");
    expect(text).toContain("https://x/upload/abc");
  });
  it("alles da, Termin noch nicht gewählt: Buchungslink", () => {
    expect(statusAnswer({ appointments: [], missing: [], bookingLink: "https://x/termin/abc", T, now })).toContain("https://x/termin/abc");
  });
});

describe("Betriebsangaben für allgemeine Fragen", () => {
  it("Leistungen, Gebiet, Kontakt und Termintage", () => {
    const facts = businessFacts(
      {
        name: "Dach Muster",
        services: ["Dachreparatur", "Dachrinnen", "Sonstiges"],
        address: "Hauptstr. 1, 80937 München",
        phone: "089 123",
        website: "dach-muster.de",
        businessProfile: { industry: "Dachdeckerei", description: "", documents: [], humanTopics: [], interview: { area: "München und 30 km Umkreis" } },
      },
      { workingDays: [1, 2, 3, 4, 5], slotStart: "08:00", slotEnd: "16:00" },
    );
    expect(facts).toContain("Leistungen (vollständige Liste): Dachreparatur, Dachrinnen");
    expect(facts).not.toContain("Sonstiges");
    expect(facts).toContain("Einsatzgebiet: München und 30 km Umkreis");
    expect(facts).toContain("Telefon: 089 123");
    expect(facts).toContain("Montag bis Freitag, 08:00–16:00 Uhr");
  });
});

describe("E-Mail: Frage nach dem Stand wird automatisch beantwortet", () => {
  let store: Store;
  beforeEach(async () => {
    delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
    store = createMemoryStore();
    await store.saveServiceMessage({ service: "iSFP", body: "Vielen Dank für Ihre iSFP-Anfrage. Bitte schicken Sie uns Ihren Grundriss.", appointmentNote: "", requiresFloorplan: true, requiresEnergyCertificate: false });
  });
  const email = (text: string, sessionId: string | null = null) =>
    processIntakeMessage(store, { companyId: "demo", sessionId, text, source: "email", channel: "email", identity: { email: "kunde@example.com" } });

  it("„Haben Sie meine Mail bekommen?“: Antwort aus dem Fall statt „Aufmerksamkeit benötigt“", async () => {
    const first = await email("Hallo, ich möchte einen individuellen Sanierungsfahrplan für mein Einfamilienhaus.");
    const turn = await email("Haben Sie meine Mail bekommen?", first.sessionId);
    const c = await store.getCase(turn.sessionId);
    expect(c?.fields.needsAttention ?? "").toBe("");
    expect(turn.replies).toHaveLength(1);
    expect(turn.replies[0]).toMatch(/fehlt uns noch|vollständig vor|Wunschtermin/);
    expect((await store.listEvents(turn.sessionId)).some((e) => e.text.includes("nach dem Stand gefragt"))).toBe(true);
  });

  it("Stand + Preisfrage: bleibt beim Betrieb", async () => {
    const first = await email("Hallo, ich möchte einen individuellen Sanierungsfahrplan für mein Einfamilienhaus.");
    const turn = await email("Haben Sie meine Mail bekommen? Was kostet der iSFP bei Ihnen?", first.sessionId);
    expect((await store.getCase(turn.sessionId))?.fields.needsAttention).toMatch(/^Frage des Kunden/);
  });
});
