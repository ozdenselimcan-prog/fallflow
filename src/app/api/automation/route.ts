import { z } from "zod";
import { json, parseBody, withSession } from "@/lib/api";

/**
 * Automatik: Erinnerungen (Standard an), Buchungslink für Kunden (Standard an), Termine ohne Freigabe bestätigen (Standard aus),
 * Bitte um Bewertung nach dem Termin (Standard aus, braucht einen Bewertungslink), Antworten in der Sprache des Kunden (Standard an).
 */
export const GET = withSession(async (_req, { store }) => {
  const a = (await store.getCompany()).businessProfile.automation ?? {};
  return json({ reminders: a.reminders !== false, autoConfirm: a.autoConfirm === true, bookingLink: a.bookingLink !== false, reviews: a.reviews === true, reviewLink: a.reviewLink ?? "", multilingual: a.multilingual !== false, apptReminders: a.apptReminders !== false });
});

const schema = z.object({
  reminders: z.boolean(),
  autoConfirm: z.boolean(),
  bookingLink: z.boolean().default(true),
  reviews: z.boolean().default(false),
  multilingual: z.boolean().default(true),
  apptReminders: z.boolean().default(true),
  reviewLink: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Bitte einen vollständigen Link angeben, der mit https:// beginnt.")
    .default(""),
});

export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const data = { ...body.data, reviews: body.data.reviews && Boolean(body.data.reviewLink) };
    const company = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...company.businessProfile, automation: data } });
    return json(data);
  },
  { permission: "assistant:manage" },
);
