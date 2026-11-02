import { describe, expect, it } from "vitest";
import { isTestAccount } from "./test-accounts";

describe("Testkonten", () => {
  it("erkennt nur automatisch erzeugte Konten", () => {
    expect(isTestAccount("claude-trial-123@mailinator.com")).toBe(true);
    expect(isTestAccount("ffux1793466287776@mailinator.com")).toBe(true);
    expect(isTestAccount("fftrain1793394950498@mailinator.com")).toBe(true);
    expect(isTestAccount("fd1792000000000@mailinator.com")).toBe(true);
    expect(isTestAccount("ffe2e1793289078191@mailinator.com")).toBe(true);
    expect(isTestAccount("ffmd1792589336057@maildrop.cc")).toBe(true);
    expect(isTestAccount("fdvideo1793289636970@mailinator.com")).toBe(true);
    expect(isTestAccount("ffvideo1792784672641@mailinator.com")).toBe(false);
    expect(isTestAccount("ffux1793466287776@gmail.com")).toBe(false);
    expect(isTestAccount("firma@mailinator.com")).toBe(false);
  });
});
