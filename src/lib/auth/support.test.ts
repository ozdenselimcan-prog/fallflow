import { beforeEach, describe, expect, it } from "vitest";
import { readSupportToken, SUPPORT_SESSION_HOURS, supportAccessActive, supportToken } from "./support";

const C = "07c16394-8506-4924-8ed6-27d549209f9e";

describe("Support-Zugang", () => {
  beforeEach(() => {
    process.env.CONNECTIONS_SECRET = "test-geheimnis";
  });

  it("liest ein gültiges Token", () => {
    expect(readSupportToken(supportToken(C))).toBe(C);
  });

  it("lehnt veränderte und fremd signierte Tokens ab", () => {
    const token = supportToken(C);
    expect(readSupportToken(token.replace(C, "11111111-8506-4924-8ed6-27d549209f9e"))).toBeNull();
    process.env.CONNECTIONS_SECRET = "anderes-geheimnis";
    expect(readSupportToken(token)).toBeNull();
    expect(readSupportToken("unsinn")).toBeNull();
    expect(readSupportToken(undefined)).toBeNull();
  });

  it("läuft nach der Sitzungsdauer ab", () => {
    const now = Date.now();
    const token = supportToken(C, now);
    expect(readSupportToken(token, now + SUPPORT_SESSION_HOURS * 3_600_000 - 1000)).toBe(C);
    expect(readSupportToken(token, now + SUPPORT_SESSION_HOURS * 3_600_000 + 1000)).toBeNull();
  });

  it("Freigabe gilt nur bis zum Ablaufdatum", () => {
    const now = Date.parse("2026-11-21T12:00:00Z");
    expect(supportAccessActive({ grantedAt: "", grantedBy: "", until: "2026-11-28T12:00:00Z" }, now)).toBe(true);
    expect(supportAccessActive({ grantedAt: "", grantedBy: "", until: "2026-11-20T12:00:00Z" }, now)).toBe(false);
    expect(supportAccessActive(undefined, now)).toBe(false);
  });
});
