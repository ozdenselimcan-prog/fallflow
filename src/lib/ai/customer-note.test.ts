import { describe, expect, it } from "vitest";
import { customerFacingNote } from "./customer-note";

describe("customerFacingNote", () => {
  it("übersetzt technische Feldnamen ins Deutsche", () => {
    expect(customerFacingNote("type, floors, heating, service fehlen")).toBe("Gebäudetyp, Anzahl der Etagen, Heizung, gewünschte Leistung fehlen.");
  });
  it("lässt normale deutsche Hinweise unverändert", () => {
    expect(customerFacingNote("Baujahr und Wohnfläche sind leer.")).toBe("Baujahr und Wohnfläche sind leer.");
    expect(customerFacingNote("Name und Telefon fehlen")).toBe("Name und Telefon fehlen.");
  });
});
