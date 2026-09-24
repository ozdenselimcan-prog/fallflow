import { json, parseBody, withSession } from "@/lib/api";
import { companySchema } from "@/lib/validation";

export const GET = withSession(async (_req, { store }) => json({ company: await store.getCompany() }));

export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, companySchema);
    if (!body.ok) return body.res;
    return json({ company: await store.updateCompany(body.data) });
  },
  { permission: "company:manage" },
);
