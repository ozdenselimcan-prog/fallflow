import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { buildSummary, computeCompleteness } from "@/lib/cases/completeness";
import { caseCreateSchema, caseQuerySchema } from "@/lib/validation";

export const GET = withSession(async (req, { store }) => {
  const q = parseQuery(req, caseQuerySchema);
  if (!q.success) return apiError("Ungültige Filter", 400);
  return json({ cases: await store.listCases(q.data) });
});

export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, caseCreateSchema);
    if (!body.ok) return body.res;
    const { fields, source } = body.data;
    const questions = await store.listQuestions();
    const completeness = computeCompleteness(questions, fields);
    const created = await store.createCase({
      fields,
      source,
      status: completeness === 100 ? "COMPLETE" : "NEEDS_INFO",
      completeness,
      customerName: fields.name || "Unbekannt",
      service: fields.service ?? "",
      summary: buildSummary(fields),
    });
    await store.addEvent(created.id, "received", "Fall manuell angelegt");
    return json({ case: created }, 201);
  },
  { permission: "cases:write" },
);
