import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/lib/config/site";
import { passwordLinkFor } from "@/lib/setup/managed";

/**
 * Link aus der Mail „Ihr FallFlow ist eingerichtet“: führt zum Passwort-Festlegen (frischer Link bei jedem Klick, 14 Tage
 * gültig). Hat sich der Betrieb schon einmal angemeldet oder ist der Link abgelaufen, geht es zur normalen Anmeldung.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/einrichtung/zugang/[token]">) {
  const { token } = await ctx.params;
  const link = await passwordLinkFor(token).catch(() => null);
  return NextResponse.redirect(link ?? new URL("/login?hinweis=zugang", siteConfig.appUrl));
}
