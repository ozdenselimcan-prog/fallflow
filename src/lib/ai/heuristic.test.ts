import { describe, expect, it } from "vitest";
import { detectBuildingType, detectHeating, detectOwnerStatus, detectService, heuristicExtract } from "./heuristic";

describe("detectService", () => {
  it("erkennt allgemeine Förderfragen als Fördermittelberatung", () => {
    expect(detectService("Wie sieht es mit KfW-Förderung aus?")).toBe("Fördermittelberatung");
    expect(detectService("Geht da was über die BAFA?")).toBe("Fördermittelberatung");
  });

  it("erkennt konkrete Förderantragstellung/-begleitung als eigene Leistung (spezifischer als die allgemeine Fördermittelberatung)", () => {
    expect(detectService("Ich möchte einen Förderantrag stellen")).toBe("Förderantragstellung");
    expect(detectService("Ich brauche Hilfe bei der Förderbegleitung")).toBe("Förderbegleitung");
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

  it("erkennt Einzelmaßnahme vor der allgemeineren Förderantrag-Erkennung", () => {
    expect(detectService("Ich möchte eine Einzelmaßnahme fördern lassen")).toBe("Einzelmaßnahme");
    expect(detectService("Brauche eine EM-Vollmacht")).toBe("Einzelmaßnahme");
  });

  it("erkennt Hydraulischen Abgleich vor der allgemeineren Heizungs-Erkennung", () => {
    expect(detectService("Wir brauchen einen hydraulischen Abgleich unserer Heizung")).toBe("Hydraulischer Abgleich");
  });

  it("erkennt Energieberatung, auch wenn im selben Satz nur die vorhandene Heizung erwähnt wird (Regressionstest)", () => {
    // "Gasheizung" beschreibt hier nur die bestehende Anlage (eigenes Feld, siehe detectHeating) - das darf die
    // ausdrücklich gewünschte Leistung "Energieberatung" nicht zu "Heizung" verfälschen.
    expect(detectService("Energieberatung für mein Haus, Baujahr 1990, Gasheizung.")).toBe("Energieberatung");
    expect(detectService("Ich möchte eine Energieberatung, meine Heizung ist eine Wärmepumpe.")).toBe("Energieberatung");
  });

  it("erkennt 'Heizung' trotzdem, wenn tatsächlich eine neue Heizung/ein Heizungstausch gewünscht ist", () => {
    expect(detectService("Ich möchte einen Heizungstausch.")).toBe("Heizung");
    expect(detectService("Wir brauchen eine neue Heizung.")).toBe("Heizung");
  });

  it("erkennt die neuen, spezifischeren Leistungen vor den allgemeineren Heizungs-/Energieberatung-Stichworten", () => {
    expect(detectService("Wir brauchen eine Heizungsoptimierung.")).toBe("Heizungsoptimierung");
    expect(detectService("Ich möchte eine Heizungsplanung für den Neubau.")).toBe("Heizungsplanung");
    expect(detectService("Brauche eine Heizlastberechnung nach DIN EN 12831.")).toBe("Heizlastberechnung");
    expect(detectService("Ich möchte eine Beratung zur Wärmepumpe.")).toBe("Wärmepumpenberatung");
    expect(detectService("Ich baue neu und möchte eine Energieberatung für den Neubau.")).toBe("Neubau-Energieberatung");
    expect(detectService("Wir brauchen eine energetische Fachplanung.")).toBe("Energetische Fachplanung");
    expect(detectService("Brauchen wir einen GEG-Nachweis?")).toBe("GEG-Nachweise");
    expect(detectService("Wir brauchen ein Lüftungskonzept.")).toBe("Lüftungskonzept");
    expect(detectService("Es geht um eine Wärmebrückenberechnung.")).toBe("Wärmebrückenberechnung");
    expect(detectService("Ich interessiere mich für eine Photovoltaikberatung.")).toBe("Photovoltaikberatung");
    expect(detectService("Wir hätten gerne eine Thermografie unseres Hauses.")).toBe("Thermografie");
    expect(detectService("Wir brauchen einen Nachweis zum sommerlichen Wärmeschutz.")).toBe("Sommerlicher Wärmeschutz");
  });
});

describe("detectService – Langformen und Abkürzungen", () => {
  it.each([
    ["Ich brauche einen individuellen Sanierungsfahrplan", "iSFP"],
    ["Individuellersanierungsfahrplan bitte", "iSFP"],
    ["Brauche eine BEG EM Förderung", "Einzelmaßnahme"],
    ["Ich möchte eine PV Anlage", "Photovoltaikberatung"],
    ["WP Beratung", "Wärmepumpenberatung"],
    ["Gebäudeenergiegesetz Nachweis", "GEG-Nachweise"],
    ["Baubegleitung KfW 261", "Baubegleitung"],
    ["Thermographie meines Hauses", "Thermografie"],
  ])("%s → %s", (text, service) => {
    expect(detectService(text)).toBe(service);
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
