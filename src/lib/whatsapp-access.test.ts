import { afterEach, describe, expect, it } from "vitest";
import { whatsappAccess } from "./whatsapp-access";

const req = (status: "open" | "approved") => ({ whatsappRequest: { name: "A", facebook: "fb", phone: "+49", contact: "a@b.de", inApp: "no" as const, requestedAt: "2026-11-01T10:00:00Z", status } });

describe("WhatsApp-Freischaltung", () => {
  afterEach(() => {
    delete process.env.WHATSAPP_SIGNUP_OPEN;
    delete process.env.ADMIN_EMAILS;
  });

  it("ohne Freigabe durch Meta: erst anfragen, dann freigeschaltet", () => {
    expect(whatsappAccess({}, "kunde@firma.de")).toBe("request");
    expect(whatsappAccess(req("open"), "kunde@firma.de")).toBe("requested");
    expect(whatsappAccess(req("approved"), "kunde@firma.de")).toBe("approved");
  });

  it("Betreiber und nach der Meta-Freigabe: direkt verbinden", () => {
    process.env.ADMIN_EMAILS = "chef@fallflow.xyz";
    expect(whatsappAccess({}, "Chef@fallflow.xyz")).toBe("open");
    process.env.WHATSAPP_SIGNUP_OPEN = "1";
    expect(whatsappAccess({}, "kunde@firma.de")).toBe("open");
  });
});
