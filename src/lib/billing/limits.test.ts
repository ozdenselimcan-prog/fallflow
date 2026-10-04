import { describe, expect, it } from "vitest";
import { caseLimitFor, hasAiTools } from "./limits";

describe("caseLimitFor", () => {
  it("liefert die richtigen Limits je Plan", () => {
    expect(caseLimitFor("starter")).toBe(100);
    expect(caseLimitFor("pro")).toBe(500);
    expect(caseLimitFor("business")).toBeNull();
  });
});

describe("hasAiTools", () => {
  it("nur Pro und Business haben Zugriff auf die KI-Werkzeuge", () => {
    expect(hasAiTools("starter")).toBe(false);
    expect(hasAiTools("pro")).toBe(true);
    expect(hasAiTools("business")).toBe(true);
  });
});
