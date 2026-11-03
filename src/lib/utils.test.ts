import { describe, expect, it } from "vitest";
import { greeting } from "./utils";

describe("Begrüßung nach deutscher Uhrzeit", () => {
  it("wählt Morgen, Tag und Abend (Winterzeit = UTC+1)", () => {
    expect(greeting(new Date("2026-11-03T07:00:00Z"))).toBe("Guten Morgen");
    expect(greeting(new Date("2026-11-03T13:40:00Z"))).toBe("Guten Tag");
    expect(greeting(new Date("2026-11-03T18:30:00Z"))).toBe("Guten Abend");
  });
});
