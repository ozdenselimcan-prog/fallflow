import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_CODE, REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/billing/referral-code";

/** Empfehlungslink geöffnet (?ref=CODE): Code merken, damit die Empfehlung auch bei einer späteren Registrierung ohne Link zählt. */
function rememberReferral(request: NextRequest, response: NextResponse) {
  const ref = request.nextUrl.searchParams.get("ref")?.toLowerCase();
  if (ref && REFERRAL_CODE.test(ref)) response.cookies.set(REFERRAL_COOKIE, ref, { maxAge: REFERRAL_COOKIE_DAYS * 86_400, path: "/", sameSite: "lax", httpOnly: true, secure: true });
  return response;
}

const PROTECTED = ["/dashboard", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

/** Erneuert die Supabase-Session und leitet nicht eingeloggte Benutzer von geschützten Seiten um. */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return rememberReferral(request, NextResponse.next()); // Demo-Modus: keine Authentifizierung

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!user && PROTECTED.some((p) => path.startsWith(p))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }
  if (user && AUTH_PAGES.includes(path)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    return NextResponse.redirect(redirect);
  }
  return rememberReferral(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|widget.js|api/widget|api/webhooks|api/upload|api/cron|api/phone|upload/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
