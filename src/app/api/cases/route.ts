import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { refreshCase } from "@/lib/intake/case-ops";
import { caseCreateSchema, caseQuerySchema } from "@/lib/validation";

export const GET = withSession(async (req, { store }) => {
  const q = parseQuery(req, caseQuerySchema);
  if (!q.success) return apiError("Ungültige Filter", 400);
  return json({ cases: await store.listCases(q.data) });
});

/** Fall manuell anlegen (z. B. nach einem Anruf). Vollständigkeit, Status und Zusammenfassung werden automatisch berechnet. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, caseCreateSchema);
    if (!body.ok) return body.res;
    const { fields, source } = body.data;
    const created = await store.createCase({
      fields,
      source,
      status: "NEW",
      customerName: fields.name || "Unbekannt",
      service: fields.service ?? "",
    });
    await store.addEvent(created.id, "received", source === "phone" ? "Fall nach Telefonat angelegt" : "Fall manuell angelegt");
    const { caseRecord } = await refreshCase(store, created.id, { hint: "edit" });
    return json({ case: caseRecord }, 201);
  },
  { permission: "cases:write" },
);
