import { describe, expect, it, vi } from "vitest";

const completeJson = vi.fn();
vi.mock("./provider", () => ({ getAiProvider: () => ({ completeJson }) }));

const { writeServiceTexts } = await import("./service-texts");

const base = {
  companyName: "Malerbetrieb Pinsel",
  tone: "friendly" as const,
  services: ["Innenanstrich", "Fassadenanstrich"],
  fieldsByService: { Innenanstrich: ["Fläche"], Fassadenanstrich: [] },
};

describe("writeServiceTexts", () => {
  it("übernimmt je Leistung den Text der KI", async () => {
    completeJson.mockResolvedValueOnce({ texts: { Innenanstrich: "vielen Dank für Ihre Anfrage zum Innenanstrich.", Fassadenanstrich: "vielen Dank – die Fassade schauen wir uns gern an." } });
    const r = await writeServiceTexts({ ...base, profile: { industry: "Malerbetrieb", description: "", humanTopics: [] } });
    expect(r).toEqual({ Innenanstrich: "vielen Dank für Ihre Anfrage zum Innenanstrich.", Fassadenanstrich: "vielen Dank – die Fassade schauen wir uns gern an." });
  });

  it("lässt erfundene Zusagen wie 'kostenlos' weg, wenn der Betrieb das nicht angegeben hat", async () => {
    completeJson.mockResolvedValue({ texts: { Innenanstrich: "die Besichtigung ist für Sie kostenlos.", Fassadenanstrich: "vielen Dank für Ihre Anfrage." } });
    const without = await writeServiceTexts({ ...base, profile: { industry: "Malerbetrieb", description: "", humanTopics: [] } });
    expect(without).toEqual({ Fassadenanstrich: "vielen Dank für Ihre Anfrage." });
    const withStrength = await writeServiceTexts({ ...base, profile: { industry: "Malerbetrieb", description: "", humanTopics: [], interview: { strengths: ["Kostenlose Besichtigung"] } } });
    expect(withStrength?.Innenanstrich).toBe("die Besichtigung ist für Sie kostenlos.");
  });
});
