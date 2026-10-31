import { apiError, json, parseBody, withSession } from "@/lib/api";
import { draftQuoteFor, saveQuote, sendQuote } from "@/lib/intake/quote-ops";
import { quoteSchema, readQuote } from "@/lib/quote";
import { caseIdSchema } from "@/lib/validation";

/** Angebot des Falls: GET laden, PUT speichern, POST KI-Entwurf (?action=draft) bzw. an den Kunden senden (?action=send). */
export const GET = withSession(async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/quote">) => {
  const { id } = await ctx.params;
  if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
  const c = await store.getCase(id);
  if (!c) return apiError("Nicht gefunden", 404);
  return json({ quote: readQuote(c.fields), hasEmail: Boolean(c.fields.email) });
});

export const PUT = withSession(
  async (req, { store }, ctx: RouteContext<"/api/cases/[id]/quote">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);
    const body = await parseBody(req, quoteSchema);
    if (!body.ok) return body.res;
    return json({ quote: await saveQuote(store, c, { ...body.data, sentAt: readQuote(c.fields)?.sentAt ?? null }) });
  },
  { permission: "cases:write" },
);

export const POST = withSession(
  async (req, { store }, ctx: RouteContext<"/api/cases/[id]/quote">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);
    if (req.nextUrl.searchParams.get("action") === "send") {
      const r = await sendQuote(store, c);
      if (!r.ok) return apiError(r.message, 400);
      return json(r);
    }
    const quote = await draftQuoteFor(store, c);
    if (!quote) return apiError("Der Entwurf konnte gerade nicht erstellt werden. Bitte gleich noch einmal versuchen.", 503);
    return json({ quote });
  },
  { permission: "cases:write", limit: 20 },
);
