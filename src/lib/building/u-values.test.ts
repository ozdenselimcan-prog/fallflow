import { describe, expect, it } from "vitest";
import { estimateUValues } from "./u-values";

describe("estimateUValues", () => {
  it("liefert null ohne plausibles Baujahr", () => {
    expect(estimateUValues(undefined)).toBeNull();
    expect(estimateUValues("")).toBeNull();
    expect(estimateUValues("abc")).toBeNull();
    expect(estimateUValues("1500")).toBeNull();
    expect(estimateUValues("3000")).toBeNull();
  });

  it("ordnet ein sehr altes Baujahr der ältesten Klasse zu", () => {
    const est = estimateUValues("1935");
    expect(est?.classLabel).toBe("vor 1948");
    expect(est?.wall).toBeGreaterThan(1.5);
  });

  it("ordnet ein sehr neues Baujahr der neuesten Klasse zu", () => {
    const est = estimateUValues("2024");
    expect(est?.classLabel).toContain("ab 2016");
    expect(est?.wall).toBeLessThan(0.3);
  });

  it("neuere Baujahre haben durchgehend niedrigere (bessere) U-Werte als ältere", () => {
    const old = estimateUValues("1960")!;
    const newer = estimateUValues("2020")!;
    expect(newer.wall).toBeLessThan(old.wall);
    expect(newer.window).toBeLessThan(old.window);
    expect(newer.roof).toBeLessThan(old.roof);
  });

  it("trifft an Klassengrenzen eine eindeutige Zuordnung", () => {
    expect(estimateUValues("1983")?.classLabel).toBe("1979–1983 (1. WSVO)");
    expect(estimateUValues("1984")?.classLabel).toBe("1984–1994 (2. WSVO)");
  });
});
