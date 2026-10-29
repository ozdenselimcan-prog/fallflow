import { describe, expect, it } from "vitest";
import { CORE_FIELD_KEYS, fieldKey } from "@/lib/ai/business-profile";
import { INDUSTRY_PRESETS } from "./industry-presets";

describe("Branchen-Vorlagen", () => {
  it.each(INDUSTRY_PRESETS.map((p) => [p.title, p] as const))("%s ist in sich stimmig", (_, p) => {
    expect(p.services.length).toBeGreaterThanOrEqual(3);
    expect(new Set(p.services).size).toBe(p.services.length);
    const keys = p.fields.map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const x of p.fields) {
      // Schlüssel bleiben beim Speichern unverändert und kollidieren nicht mit Standard- oder Sonderfeldern.
      expect(fieldKey(x.key, x.label)).toBe(x.key);
      expect([...CORE_FIELD_KEYS, "floors", "buildingType", "yearBuilt", "livingArea", "heating", "ownerStatus"]).not.toContain(x.key);
      for (const s of x.services) expect(p.services).toContain(s);
    }
    for (const [s, docs] of Object.entries(p.documentsByService)) {
      expect(p.services).toContain(s);
      for (const d of docs) expect(p.documents).toContain(d);
    }
    expect(p.humanTopics.length).toBeGreaterThan(0);
  });
});

describe("Filme der Branchenseiten", async () => {
  const { INDUSTRY_FILMS } = await import("./industry-films");
  const { INDUSTRY_PAGES } = await import("./industry-pages");
  it.each(INDUSTRY_PAGES.map((p) => [p.slug] as const))("%s hat einen stimmigen Film", (slug) => {
    const film = INDUSTRY_FILMS[slug];
    expect(film).toBeTruthy();
    const marks = film.mailParts.filter((m) => m.mark !== undefined).map((m) => m.mark).sort();
    expect(marks).toEqual([0, 1, 2, 3, 4]);
    expect(film.fields).toHaveLength(5);
    expect(film.fields[0][0]).toBe("Leistung");
    expect(film.mailParts.find((m) => m.mark === 0)?.text).toBe(film.fields[0][1]);
  });
});
