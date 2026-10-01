import { describe, expect, it } from "vitest";
import { detectBuildingType, detectHeating, detectOwnerStatus, detectService, heuristicExtract } from "./heuristic";

describe("detectService", () => {
  it("erkennt Förderanträge als Fördermittelberatung", () => {
    expect(detectService("Ich möchte einen Förderantrag stellen")).toBe("Fördermittelberatung");
    expect(detectService("Wie sieht es mit KfW-Förderung aus?")).toBe("Fördermittelberatung");
    expect(detectService("Geht da was über die BAFA?")).toBe("Fördermittelberatung");
  });

  it("erkennt iSFP/Sanierungsfahrplan", () => {
    expect(detectService("Ich brauche einen Sanierungsfahrplan")).toBe("iSFP");
  });

  it("erkennt Energieausweis", () => {
    expect(detectService("Ich brauche einen Energieausweis für den Verkauf")).toBe("Energieausweis");
  });

  it("liefert leeren String ohne erkennbares Stichwort", () => {
    expect(detectService("Hallo, ich hätte eine Frage zu meinem Haus")).toBe("");
  });
});

describe("detectBuildingType", () => {
  it("erkennt Mehrfamilienhaus und Abkürzung", () => {
    expect(detectBuildingType("Es ist ein Mehrfamilienhaus")).toBe("Mehrfamilienhaus");
    expect(detectBuildingType("Wir haben ein MFH mit 6 Einheiten")).toBe("Mehrfamilienhaus");
  });

  it("erkennt Einfamilienhaus-Varianten", () => {
    expect(detectBuildingType("Unser Einfamilienhaus")).toBe("Einfamilienhaus");
    expect(detectBuildingType("Es ist ein Reihenhaus")).toBe("Einfamilienhaus");
  });
});

describe("detectHeating", () => {
  it("unterscheidet Heizungsarten korrekt", () => {
    expect(detectHeating("Wir haben eine Wärmepumpe")).toBe("Wärmepumpe");
    expect(detectHeating("aktuell Ölheizung")).toBe("Öl");
    expect(detectHeating("Gasheizung von 2005")).toBe("Gas");
  });
});

describe("detectOwnerStatus", () => {
  it("erkennt nur ausdrückliche Aussagen", () => {
    expect(detectOwnerStatus("Ich bin Eigentümer des Hauses")).toBe("Eigentümer");
    expect(detectOwnerStatus("Wir wohnen zur Miete")).toBe("Mieter");
    expect(detectOwnerStatus("Wir haben ein Haus gekauft")).toBe("");
  });
});

describe("heuristicExtract", () => {
  it("extrahiert mehrere Felder aus einem Fließtext", () => {
    const text = "Ich bin Max Mustermann, Eigentümer eines Einfamilienhauses, Baujahr 1998, 140 m², Musterstraße 12, 80331. Meine E-Mail ist max@example.com";
    const out = heuristicExtract(text);
    expect(out.name).toBe("Max Mustermann");
    expect(out.buildingType).toBe("Einfamilienhaus");
    expect(out.ownerStatus).toBe("Eigentümer");
    expect(out.yearBuilt).toBe("1998");
    expect(out.livingArea).toBe("140");
    expect(out.postalCode).toBe("80331");
    expect(out.email).toBe("max@example.com");
  });

  it("verwirft unplausible Baujahre (in der Zukunft)", () => {
    const out = heuristicExtract("Baujahr 2099");
    expect(out.yearBuilt).toBeUndefined();
  });

  it("erkennt keinen Namen aus Nicht-Namen-Phrasen", () => {
    const out = heuristicExtract("Eigentümer eines Hauses in München");
    expect(out.name).toBeUndefined();
  });
});
