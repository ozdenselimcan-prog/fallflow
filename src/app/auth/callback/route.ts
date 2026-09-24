import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/lib/config/site";
import { createUserClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";

/** Tauscht den Code aus E-Mail-Bestätigung bzw. Passwort-Reset gegen eine Session. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const rawNext = req.nextUrl.searchParams.get("next") ?? "/dashboard";
  // Nur interne Pfade zulassen (Open-Redirect-Schutz)
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code && isSupabaseConfigured()) {
    const db = await createUserClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, siteConfig.appUrl));
  }
  return NextResponse.redirect(new URL("/login?error=callback", siteConfig.appUrl));
}
