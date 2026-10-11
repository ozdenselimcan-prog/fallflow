import { describe, expect, it } from "vitest";
import { officeAlreadyRequests } from "./document-mentions";

describe("officeAlreadyRequests", () => {
  it.each([
    ["Bitte schicken Sie uns Ihren Grundriss.", "floorplan", true],
    ["Wir benötigen außerdem die Baupläne Ihres Hauses.", "floorplan", true],
    ["Falls vorhanden, senden Sie uns bitte den alten Energiepass.", "energy_certificate", true],
    ["Bitte legen Sie Ihren Energieausweis bei.", "energy_certificate", true],
    ["Vielen Dank für Ihre Anfrage zum Energieausweis.", "energy_certificate", false],
    ["Vielen Dank für Ihre Anfrage.", "floorplan", false],
    ["Bitte schicken Sie uns Ihren Grundriss.", "energy_certificate", false],
  ] as const)("%s (%s) → %s", (message, kind, expected) => {
    expect(officeAlreadyRequests(message, kind)).toBe(expected);
  });
});
