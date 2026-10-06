import { json, parseBody, withSession } from "@/lib/api";
import { syncServiceQuestionOptions } from "@/lib/intake/case-ops";
import { companySchema } from "@/lib/validation";

export const GET = withSession(async (_req, { store }) => json({ company: await store.getCompany() }));

export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, companySchema);
    if (!body.ok) return body.res;
    const company = await store.updateCompany(body.data);
    if (body.data.services) await syncServiceQuestionOptions(store, body.data.services);
    return json({ company });
  },
  { permission: "company:manage" },
);
