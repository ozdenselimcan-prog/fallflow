import { describe, expect, it } from "vitest";
import { normalizeTrialEmail, trialEmailHash } from "./trial-usage";

describe("normalizeTrialEmail", () => {
  it("andere Schreibweisen derselben Adresse zählen gleich", () => {
    expect(normalizeTrialEmail(" Max.Muster+test@GoogleMail.com ")).toBe("maxmuster@gmail.com");
    expect(normalizeTrialEmail("info+fallflow@energie-muster.de")).toBe("info@energie-muster.de");
  });
  it("Punkte bleiben außerhalb von Gmail erhalten", () => {
    expect(normalizeTrialEmail("max.muster@web.de")).toBe("max.muster@web.de");
  });
  it("Prüfwert ist gleich für gleiche Adressen", () => {
    expect(trialEmailHash("Max.Muster@gmail.com")).toBe(trialEmailHash("maxmuster+2@gmail.com"));
    expect(trialEmailHash("a@web.de")).not.toBe(trialEmailHash("b@web.de"));
  });
});
