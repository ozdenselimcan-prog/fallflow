import { afterEach, describe, expect, it, vi } from "vitest";
import { microsoftProvider } from "./microsoft";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("microsoftProvider.missingConfig", () => {
  it("meldet fehlende App-Zugangsdaten, leer wenn beide gesetzt sind", () => {
    vi.stubEnv("MICROSOFT_CLIENT_ID", "");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "");
    expect(microsoftProvider.missingConfig()).toEqual(["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"]);

    vi.stubEnv("MICROSOFT_CLIENT_ID", "id123");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "secret123");
    expect(microsoftProvider.missingConfig()).toEqual([]);
  });
});

describe("microsoftProvider.getAuthUrl", () => {
  it("baut eine gültige Microsoft-OAuth-URL mit Client-ID, Redirect und State", () => {
    vi.stubEnv("MICROSOFT_CLIENT_ID", "id123");
    const url = new URL(microsoftProvider.getAuthUrl("state-abc", "https://app.example.com/api/integrations/microsoft"));
    expect(url.origin + url.pathname).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(url.searchParams.get("client_id")).toBe("id123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/integrations/microsoft");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("response_mode")).toBe("query");
  });
});
