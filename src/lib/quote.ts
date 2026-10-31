import { z } from "zod";

/**
 * Kostenvoranschlag/Angebot eines Falls. Gespeichert als JSON im Fall-Feld „quote“ (keine eigene Tabelle nötig).
 * Beträge in Euro; Preis null = vom Betrieb noch zu ergänzen (dann kann nicht gesendet werden).
 */
export const QUOTE_FIELD = "quote";

export const quoteItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  qty: z.number().min(0).max(100000).default(1),
  unit: z.string().trim().max(20).default("Stk."),
  unitPrice: z.number().min(0).max(10_000_000).nullable().default(null),
});
export const quoteSchema = z.object({
  intro: z.string().max(1500).default(""),
  items: z.array(quoteItemSchema).max(40).default([]),
  /** 19, 7 oder 0 (Kleinunternehmer, § 19 UStG) */
  vatRate: z.union([z.literal(19), z.literal(7), z.literal(0)]).default(19),
  validDays: z.number().int().min(1).max(365).default(30),
  number: z.string().max(40).default(""),
  sentAt: z.string().max(40).nullable().default(null),
});
export type QuoteItem = z.infer<typeof quoteItemSchema>;
export type Quote = z.infer<typeof quoteSchema>;

export function readQuote(fields: Record<string, string>): Quote | null {
  const raw = fields[QUOTE_FIELD];
  if (!raw) return null;
  try {
    const parsed = quoteSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export function quoteTotals(q: Pick<Quote, "items" | "vatRate">) {
  const net = round2(q.items.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.qty, 0));
  const vat = round2((net * q.vatRate) / 100);
  return { net, vat, gross: round2(net + vat), complete: q.items.length > 0 && q.items.every((i) => i.unitPrice !== null) };
}

export const euro = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

/** Angebotsnummer: A-JJJJMMTT-xxxx (Fall-Kennung), stabil je Fall. */
export const quoteNumber = (caseId: string, date = new Date()) =>
  `A-${date.toISOString().slice(0, 10).replace(/-/g, "")}-${caseId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
