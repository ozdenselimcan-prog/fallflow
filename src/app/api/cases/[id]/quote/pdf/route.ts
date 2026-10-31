import { NextResponse } from "next/server";
import { apiError, withSession } from "@/lib/api";
import { quotePdfFor } from "@/lib/intake/quote-ops";
import { readQuote } from "@/lib/quote";
import { caseIdSchema } from "@/lib/validation";

/** Vorschau des gespeicherten Angebots als PDF. */
export const GET = withSession(async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/quote/pdf">) => {
  const { id } = await ctx.params;
  if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
  const c = await store.getCase(id);
  if (!c) return apiError("Nicht gefunden", 404);
  const pdf = await quotePdfFor(store, c);
  if (!pdf) return apiError("Noch kein Angebot gespeichert", 404);
  const number = readQuote(c.fields)?.number ?? "Angebot";
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Angebot-${number}.pdf"`, "Cache-Control": "no-store" },
  });
});
