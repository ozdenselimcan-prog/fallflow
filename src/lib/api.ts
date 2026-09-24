import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { can, type Permission } from "@/lib/auth/permissions";
import { getSession, type Session } from "@/lib/auth/session";
import { getStore } from "@/lib/data";
import type { Store } from "@/lib/data/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const apiError = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function parseBody<T extends z.ZodType>(req: NextRequest, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: apiError("Ungültiger Request-Body", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, res: apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", 400) };
  return { ok: true, data: parsed.data };
}

export function parseQuery<T extends z.ZodType>(req: NextRequest, schema: T) {
  const obj = Object.fromEntries([...req.nextUrl.searchParams.entries()].filter(([, v]) => v !== ""));
  return schema.safeParse(obj);
}

/** CSRF-Schutz zusätzlich zu SameSite-Cookies: mutierende Requests müssen vom eigenen Host kommen. */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Nicht-Browser-Clients / same-origin GET ohne Origin
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

interface Ctx {
  session: Session;
  store: Store;
}

/** Wrapper für Dashboard-API-Routen: Auth, CSRF-Check, Rechteprüfung, Rate-Limit, einheitliche Fehler. */
export function withSession<A extends unknown[]>(
  handler: (req: NextRequest, ctx: Ctx, ...rest: A) => Promise<NextResponse>,
  opts: { permission?: Permission; limit?: number } = {},
) {
  return async (req: NextRequest, ...rest: A): Promise<NextResponse> => {
    try {
      if (req.method !== "GET" && !sameOrigin(req)) return apiError("Ungültige Herkunft der Anfrage", 403);
      const session = await getSession();
      if (!session) return apiError("Nicht angemeldet", 401);
      if (opts.permission && !can(session.role, opts.permission)) return apiError("Keine Berechtigung", 403);
      if (!rateLimit(`api:${session.userId}:${req.method}`, opts.limit ?? 120, 60_000)) return apiError("Zu viele Anfragen", 429);
      return await handler(req, { session, store: await getStore(session) }, ...rest);
    } catch (err) {
      console.error("[api]", req.method, req.nextUrl.pathname, err instanceof Error ? err.message : "Fehler");
      return apiError("Interner Fehler", 500);
    }
  };
}

/** Wrapper für öffentliche Routen (Widget, Demo): Rate-Limit pro IP, Origin-unabhängig. */
export function publicRoute<A extends unknown[]>(
  name: string,
  limit: number,
  handler: (req: NextRequest, ...rest: A) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ...rest: A): Promise<NextResponse> => {
    try {
      if (!rateLimit(`${name}:${clientIp(req)}`, limit, 60_000)) return apiError("Zu viele Anfragen. Bitte kurz warten.", 429);
      return await handler(req, ...rest);
    } catch (err) {
      console.error("[api]", name, err instanceof Error ? err.message : "Fehler");
      return apiError("Der Assistent konnte die Anfrage gerade nicht verarbeiten. Bitte versuchen Sie es erneut.", 500);
    }
  };
}
