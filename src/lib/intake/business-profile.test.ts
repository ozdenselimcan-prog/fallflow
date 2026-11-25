import { describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "@/lib/data/memory";
import { saveBusinessProfile } from "./business-profile";

describe("saveBusinessProfile", () => {
  it("löscht keine WhatsApp-Fragen (die gibt es nur virtuell, nicht als Datensatz)", async () => {
    delete (globalThis as unknown as { __fallflowDb?: unknown }).__fallflowDb;
    const store = createMemoryStore();
    const company = await store.getCompany();
    await store.updateCompany({
      businessProfile: { ...company.businessProfile, industry: "Malerbetrieb", whatsappQuestions: [{ key: "untergrund", label: "Untergrund", prompt: "Welcher Untergrund?", services: [] }] },
    });
    expect((await store.listQuestions()).some((q) => q.id === "wa-untergrund")).toBe(true);

    const deleted = vi.spyOn(store, "deleteQuestion");
    await saveBusinessProfile(store, {
      ...(await store.getCompany()).businessProfile,
      industry: "Malerbetrieb",
      description: "",
      services: ["Innenanstrich"],
      fields: [{ key: "flaeche", label: "Fläche (m²)", prompt: "Wie groß ist die Fläche?", required: false }],
      documents: [],
      humanTopics: ["Preise und Kosten"],
    });
    expect(deleted.mock.calls.some(([id]) => String(id).startsWith("wa-"))).toBe(false);
  });
});
