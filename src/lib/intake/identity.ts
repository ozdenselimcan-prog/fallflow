import type { CaseRecord } from "@/lib/data/types";

/** Vereinheitlicht Telefonnummern (deutsches Format) zum Vergleichen: 0170 123 → +49170123. */
export function normalizePhone(raw: string): { digits: string; display: string } {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = `49${digits.slice(1)}`;
  }
  return { digits, display: digits ? `+${digits}` : "" };
}

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

/**
 * Ordnet eine eingehende Nachricht dem richtigen Fall zu (E-Mail-Adresse oder Telefonnummer).
 * Offene Fälle haben Vorrang vor bereits übernommenen; unter mehreren gilt der zuletzt aktive.
 */
export function findCaseByIdentity(cases: CaseRecord[], identity: { email?: string; phone?: string }): CaseRecord | null {
  const email = identity.email ? normalizeEmail(identity.email) : "";
  const phone = identity.phone ? normalizePhone(identity.phone).digits : "";
  if (!email && !phone) return null;
  const matches = cases.filter((c) => {
    if (email && c.fields.email && normalizeEmail(c.fields.email) === email) return true;
    return Boolean(phone && c.fields.phone && normalizePhone(c.fields.phone).digits === phone);
  });
  const open = matches.filter((c) => c.status !== "CONVERTED");
  return (open.length ? open : []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}
