import { resolveMx } from "node:dns/promises";
import { z } from "zod";
import { json, parseQuery, withSession } from "@/lib/api";
import { providerForEmail, providerForMx } from "@/lib/integrations/mail-providers";

/** E-Mail-Anbieter zu einer Adresse erkennen: Freemail an der Domain, eigene Domain am MX-Eintrag (DNS). */
export const GET = withSession(async (req) => {
  const q = parseQuery(req, z.object({ email: z.string().trim().max(200) }));
  if (!q.success) return json({ provider: null });
  const known = providerForEmail(q.data.email);
  if (known) return json({ provider: known.id });
  const domain = q.data.email.toLowerCase().split("@")[1] ?? "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return json({ provider: null });
  try {
    const mx = await Promise.race([resolveMx(domain), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))]);
    return json({ provider: providerForMx(mx.map((m) => m.exchange))?.id ?? null });
  } catch {
    return json({ provider: null });
  }
});
