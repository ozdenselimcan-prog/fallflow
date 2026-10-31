import { z } from "zod";
import { json, parseBody, withSession } from "@/lib/api";

/** Automatik: Erinnerungen (Standard an), Buchungslink für Kunden (Standard an), Termine ohne Freigabe bestätigen (Standard aus). */
export const GET = withSession(async (_req, { store }) => {
  const a = (await store.getCompany()).businessProfile.automation ?? {};
  return json({ reminders: a.reminders !== false, autoConfirm: a.autoConfirm === true, bookingLink: a.bookingLink !== false });
});

const schema = z.object({ reminders: z.boolean(), autoConfirm: z.boolean(), bookingLink: z.boolean().default(true) });

export const PUT = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const company = await store.getCompany();
    await store.updateCompany({ businessProfile: { ...company.businessProfile, automation: body.data } });
    return json(body.data);
  },
  { permission: "assistant:manage" },
);
