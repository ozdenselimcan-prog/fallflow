import { describe, expect, it } from "vitest";
import { estimateFoerderung, foerderDraftText } from "./estimate";

describe("estimateFoerderung", () => {
  it("liefert null für nicht-förderrelevante Leistungen", () => {
    expect(estimateFoerderung({ service: "Energieausweis" })).toBeNull();
    expect(estimateFoerderung({ service: "iSFP" })).toBeNull();
    expect(estimateFoerderung({})).toBeNull();
  });

  it("liefert null für Mieter (Antragsteller muss i.d.R. Eigentümer sein)", () => {
    expect(estimateFoerderung({ service: "Heizung", ownerStatus: "Mieter" })).toBeNull();
  });

  it("Grundförderung 30% als Minimum, ohne fossile Heizung kein Geschwindigkeitsbonus", () => {
    const est = estimateFoerderung({ service: "Heizung", heating: "Wärmepumpe", ownerStatus: "Eigentümer" });
    expect(est).not.toBeNull();
    expect(est!.minPercent).toBe(30);
    expect(est!.bullets.some((b) => b.includes("Geschwindigkeitsbonus"))).toBe(false);
  });

  it("Geschwindigkeitsbonus nur bei fossiler Bestandsheizung (Gas/Öl)", () => {
    const gas = estimateFoerderung({ service: "Heizung", heating: "Gas", ownerStatus: "Eigentümer" });
    expect(gas!.bullets.some((b) => b.includes("Geschwindigkeitsbonus"))).toBe(true);
    const oel = estimateFoerderung({ service: "Einzelmaßnahme", heating: "Öl", ownerStatus: "Eigentümer" });
    expect(oel!.bullets.some((b) => b.includes("Geschwindigkeitsbonus"))).toBe(true);
  });

  it("maximale Förderquote ist auf 70% gedeckelt", () => {
    const est = estimateFoerderung({ service: "Heizung", heating: "Gas", ownerStatus: "Eigentümer" });
    expect(est!.maxPercent).toBe(70);
  });

  it("funktioniert für alle förderrelevanten Leistungen", () => {
    for (const service of ["Heizung", "Einzelmaßnahme", "Sanierung", "Fördermittelberatung"]) {
      expect(estimateFoerderung({ service, ownerStatus: "Eigentümer" })).not.toBeNull();
    }
  });
});

describe("foerderDraftText", () => {
  it("enthält Begrüßung mit Namen, Prozentspanne, Stichpunkte und den Unverbindlichkeits-Hinweis", () => {
    const estimate = { minPercent: 30, maxPercent: 70, bullets: ["Grundförderung: 30 %.", "Bonus XY."] };
    const text = foerderDraftText("Max Mustermann", estimate);
    expect(text).toContain("Guten Tag Max Mustermann,");
    expect(text).toContain("30 % und 70 %");
    expect(text).toContain("Grundförderung: 30 %.");
    expect(text).toContain("unverbindliche Erst-Einschätzung, keine Förderzusage");
  });

  it("fällt auf generische Begrüßung zurück, wenn kein Name vorliegt", () => {
    const text = foerderDraftText("", { minPercent: 30, maxPercent: 30, bullets: [] });
    expect(text).toContain("Guten Tag,");
  });
});
