import { z } from "zod";
import { json, parseBody, withSession } from "@/lib/api";
import { saveBusinessProfile } from "@/lib/intake/business-profile";

const str = (max: number) => z.string().trim().max(max);
const schema = z.object({
  industry: str(60).min(1, "Bitte die Branche angeben"),
  description: str(600).default(""),
  services: z.array(str(60)).min(1, "Bitte mindestens eine Leistung angeben").max(30),
  fields: z.array(z.object({ key: str(40).default(""), label: str(60).min(1), prompt: str(200).default(""), required: z.boolean().default(false), services: z.array(str(60)).max(30).optional() })).max(12),
  documents: z.array(str(80)).max(10).default([]),
  humanTopics: z.array(str(80)).max(12).default([]),
  documentsByService: z.record(str(60), z.array(str(80)).max(10)).optional(),
  needsAddress: z.boolean().default(true),
});

/** Betriebsprofil speichern (Einrichtung und Einstellungen). */
export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    await saveBusinessProfile(store, {
      ...body.data,
      fields: body.data.fields.map((f) => ({ ...f, prompt: f.prompt || `${f.label}?` })),
    });
    return json({ ok: true });
  },
  { permission: "company:manage" },
);

export const GET = withSession(async (_req, { store }) => {
  const [company, questions] = await Promise.all([store.getCompany(), store.listQuestions()]);
  return json({ profile: company.businessProfile, services: company.services, questions });
});
