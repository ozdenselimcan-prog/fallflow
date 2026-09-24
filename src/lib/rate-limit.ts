import type { NextRequest } from "next/server";

/**
 * Einfaches In-Memory-Rate-Limiting (Sliding Window pro Instanz).
 * Für den Produktivbetrieb mit mehreren Instanzen durch einen geteilten Store (z. B. Upstash Redis) ersetzen –
 * die Signatur von rateLimit() kann dabei gleich bleiben.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
  return true;
}

export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
