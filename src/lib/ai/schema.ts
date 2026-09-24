import { z } from "zod";
import { BUILDING_TYPES, HEATING_TYPES, OWNER_STATUSES, SERVICES } from "@/lib/cases/fields";

/** Erwartetes JSON der KI-Extraktion. Alles wird strikt validiert, bevor es übernommen wird. */
export const extractionSchema = z.object({
  customer: z
    .object({ name: z.string().default(""), email: z.string().default(""), phone: z.string().default(""), ownerStatus: z.string().default("") })
    .default({ name: "", email: "", phone: "", ownerStatus: "" }),
  property: z
    .object({
      type: z.string().default(""),
      yearBuilt: z.number().int().nullable().default(null),
      livingArea: z.number().nullable().default(null),
      floors: z.number().int().nullable().default(null),
      street: z.string().default(""),
      postalCode: z.string().default(""),
    })
    .default({ type: "", yearBuilt: null, livingArea: null, floors: null, street: "", postalCode: "" }),
  heating: z.object({ type: z.string().default("") }).default({ type: "" }),
  request: z.object({ service: z.string().default(""), description: z.string().default("") }).default({ service: "", description: "" }),
  missingFields: z.array(z.string()).default([]),
  completionPercent: z.number().min(0).max(100).default(0),
});

export type Extraction = z.infer<typeof extractionSchema>;

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const clean = (s: string, max = 200) => s.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function matchOption(value: string, options: readonly string[]): string {
  const v = value.trim().toLowerCase();
  if (!v) return "";
  const abbreviations: Record<string, string> = { efh: "Einfamilienhaus", mfh: "Mehrfamilienhaus" };
  if (abbreviations[v] && options.includes(abbreviations[v])) return abbreviations[v];
  return options.find((o) => o.toLowerCase() === v) ?? options.find((o) => o.length >= 3 && v.includes(o.toLowerCase())) ?? "";
}

/** Wandelt eine validierte Extraktion in Feldwerte um – nur plausible Werte, sonst weglassen. */
export function extractionToFields(ex: Extraction): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (k: string, v: string) => v && (out[k] = v);
  const year = ex.property.yearBuilt;
  const area = ex.property.livingArea;
  const floors = ex.property.floors;

  set("name", clean(ex.customer.name, 100));
  if (EMAIL.test(ex.customer.email.trim())) set("email", ex.customer.email.trim().toLowerCase());
  if (/^[+\d][\d\s/()-]{5,24}$/.test(ex.customer.phone.trim())) set("phone", ex.customer.phone.trim());
  set("ownerStatus", matchOption(ex.customer.ownerStatus, OWNER_STATUSES));
  set("buildingType", matchOption(ex.property.type, BUILDING_TYPES));
  if (year && year >= 1600 && year <= new Date().getFullYear()) set("yearBuilt", String(year));
  if (area && area >= 10 && area <= 100000) set("livingArea", String(Math.round(area)));
  if (floors && floors >= 1 && floors <= 30) set("floors", String(floors));
  set("street", clean(ex.property.street, 120));
  if (/^\d{5}$/.test(ex.property.postalCode.trim())) set("postalCode", ex.property.postalCode.trim());
  set("heating", matchOption(ex.heating.type, HEATING_TYPES));
  set("service", matchOption(ex.request.service, SERVICES));
  set("description", clean(ex.request.description, 1000));
  return out;
}
