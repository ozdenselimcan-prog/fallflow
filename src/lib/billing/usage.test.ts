import { describe, expect, it } from "vitest";
import type { CaseRecord, Subscription } from "@/lib/data/types";
import { canCreateCase, casesThisMonth } from "./usage";

const caseAt = (iso: string): CaseRecord =>
  ({
    id: iso,
    companyId: "c1",
    status: "NEW",
    completeness: 0,
    customerName: "Test",
    service: "",
    source: "manual",
    summary: "",
    assignedTo: null,
    createdAt: iso,
    updatedAt: iso,
    fields: {},
    uploadToken: null,
    uploadTokenExpiresAt: null,
  }) as CaseRecord;

function fakeStore(cases: CaseRecord[], plan: Subscription["plan"]) {
  return {
    listCases: async () => cases,
    getSubscription: async () => ({ plan, status: "active", currentPeriodEnd: null, stripeCustomerId: null }) as Subscription,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("casesThisMonth", () => {
  it("zählt nur Fälle aus dem laufenden Kalendermonat", () => {
    const now = new Date();
    const thisMonth1 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const thisMonth2 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15)).toISOString();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString();
    const store = fakeStore([caseAt(thisMonth1), caseAt(thisMonth2), caseAt(lastMonth)], "pro");
    return casesThisMonth(store).then((n) => expect(n).toBe(2));
  });
});

describe("canCreateCase", () => {
  it("erlaubt weitere Fälle, solange das Limit nicht erreicht ist", async () => {
    const now = new Date().toISOString();
    const store = fakeStore([caseAt(now), caseAt(now)], "starter");
    const quota = await canCreateCase(store);
    expect(quota).toEqual({ allowed: true, limit: 100, used: 2 });
  });

  it("blockiert, sobald das Limit erreicht ist", async () => {
    const now = new Date().toISOString();
    const store = fakeStore(Array.from({ length: 100 }, () => caseAt(now)), "starter");
    const quota = await canCreateCase(store);
    expect(quota.allowed).toBe(false);
    expect(quota.used).toBe(100);
  });

  it("Business-Plan hat kein Limit, egal wie viele Fälle", async () => {
    const now = new Date().toISOString();
    const store = fakeStore(Array.from({ length: 10_000 }, () => caseAt(now)), "business");
    const quota = await canCreateCase(store);
    expect(quota.allowed).toBe(true);
    expect(quota.limit).toBeNull();
  });
});
