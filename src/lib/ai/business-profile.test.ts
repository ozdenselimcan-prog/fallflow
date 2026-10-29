import { describe, expect, it, vi } from "vitest";

vi.mock("./provider", () => ({ getAiProvider: () => null }));
const { fieldKey, normalizeSuggestion } = await import("./business-profile");

describe("Betriebsprofil", () => {
  it("bildet sichere Schlüssel", () => {
    expect(fieldKey("", "Dachfläche (m²)")).toBe("dachflaecheM2");
    expect(fieldKey("roof area", "")).toBe("roofArea");
    expect(fieldKey("email", "E-Mail")).toBe("emailDetail");
  });
  it("bereinigt einen Vorschlag", () => {
    const s = normalizeSuggestion({
      industry: "Dachdeckerei",
      description: "Reparaturen und Neueindeckung.",
      services: ["Dachreparatur", "dachreparatur", "Neueindeckung", ""],
      fields: [
        { key: "roofArea", label: "Dachfläche", prompt: "Wie groß ist die Dachfläche?", required: true },
        { key: "roofArea", label: "Doppelt", prompt: "", required: false },
        { key: "", label: "", prompt: "", required: false },
      ],
      documents: ["Fotos vom Schaden"],
      humanTopics: ["Preise"],
    });
    expect(s?.services).toEqual(["Dachreparatur", "Neueindeckung"]);
    expect(s?.fields.map((f) => f.key)).toEqual(["roofArea"]);
  });
  it("lehnt unbrauchbare Antworten ab", () => {
    expect(normalizeSuggestion({ services: "kaputt" })).toBeNull();
  });
});

describe("Leistungs-Zuordnung", async () => {
  const { matchService } = await import("./schema");
  const services = ["Schadensmeldungen aufnehmen", "Wallbox-Installation", "Nebenkostenabrechnung", "Heizungswartung"];
  it("erkennt leicht abweichende Schreibweisen", () => {
    expect(matchService("Schadensmeldung", services)).toBe("Schadensmeldungen aufnehmen");
    expect(matchService("Wallbox", services)).toBe("Wallbox-Installation");
    expect(matchService("Nebenkostenabrechnung", services)).toBe("Nebenkostenabrechnung");
    expect(matchService("Sonstiges", services)).toBe("Sonstiges");
    expect(matchService("Badsanierung", services)).toBe("");
  });
  it("übernimmt Leistungs-Einschränkungen nur für bekannte Leistungen", () => {
    const s = normalizeSuggestion({
      industry: "SHK",
      services: ["Heizungswartung", "Badsanierung", "Rohrreinigung"],
      fields: [
        { key: "heatingType", label: "Heizungsart", prompt: "Welche Heizung?", required: true, services: ["Heizungswartung", "Unbekannt"] },
        { key: "problem", label: "Problembeschreibung", prompt: "?", required: true, services: [] },
        { key: "size", label: "Größe", prompt: "?", required: false, services: ["Heizungswartung", "Badsanierung", "Rohrreinigung"] },
      ],
    });
    expect(s?.fields.map((f) => [f.key, f.services])).toEqual([
      ["heatingType", ["Heizungswartung"]],
      ["size", []],
    ]);
  });
});
