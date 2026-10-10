import { apiError, json, withSession } from "@/lib/api";
import { syncFollowUps } from "@/lib/intake/case-ops";
import { buildChecklist } from "@/lib/intake/checklist";
import { caseIdSchema } from "@/lib/validation";

/** Follow-up für einen Fall planen (auch wenn automatische Follow-ups im Assistenten ausgeschaltet sind). */
export const POST = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/follow-ups">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);
    if (!c.fields.email && !c.fields.phone) return apiError("Für ein Follow-up fehlt eine E-Mail-Adresse oder Telefonnummer.", 400);
    const [questions, documents, company, templateDocs, templates, serviceMessages] = await Promise.all([
      store.listQuestions(),
      store.listDocuments(id),
      store.getCompany(),
      store.listTemplateDocuments(id),
      store.listDocumentTemplates(),
      store.listServiceMessages(),
    ]);
    const templateTitleById = new Map(templates.map((t) => [t.id, t.title]));
    const checklist = buildChecklist({
      questions,
      fields: c.fields,
      documents,
      foerderOverrides: { energyCertificate: company.foerderEnergyCertificate, floorplan: company.foerderFloorplan },
      serviceMessages,
      templateSends: templateDocs.map((td) => ({ id: td.id, title: templateTitleById.get(td.templateId) ?? "Vorlage", status: td.status, filled: td.filled })),
      includeFields: c.source !== "email",
    });
    if (checklist.missing.length === 0) return apiError("Es fehlt nichts – kein Follow-up nötig.", 400);
    await syncFollowUps(store, c, checklist, { force: true });
    return json({ followUps: await store.listFollowUps(id) }, 201);
  },
  { permission: "cases:write" },
);
