import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { fetchWebsiteText, suggestBusinessProfile } from "@/lib/ai/business-profile";

const schema = z.object({ description: z.string().trim().max(2000).default(""), website: z.string().trim().max(200).default("") });

/** KI-Vorschlag für das Betriebsprofil aus Beschreibung und/oder Website. */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const { description, website } = body.data;
    if (!description && !website) return apiError("Bitte beschreiben Sie Ihren Betrieb oder geben Sie Ihre Website an.", 400);
    const [company, websiteText] = await Promise.all([store.getCompany(), website ? fetchWebsiteText(website) : Promise.resolve("")]);
    if (!description && !websiteText) return apiError("Die Website konnte nicht gelesen werden. Bitte beschreiben Sie Ihren Betrieb in ein paar Sätzen.", 400);
    const suggestion = await suggestBusinessProfile({ companyName: company.name, description, websiteText });
    if (!suggestion) return apiError("Der Vorschlag konnte gerade nicht erstellt werden. Bitte versuchen Sie es noch einmal.", 503);
    return json({ suggestion, websiteRead: Boolean(websiteText) });
  },
  { permission: "company:manage", limit: 10 },
);
