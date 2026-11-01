import { isPlatformAdmin } from "@/lib/admin/overview";
import type { BusinessProfile } from "@/lib/data/types";

/**
 * WhatsApp-Einrichtung für fremde Betriebe: Solange die Meta-App nicht im App Review freigegeben ist, klappt „Mit Facebook
 * verbinden“ nur für Personen, die in der Meta-App eine Rolle haben (z. B. Tester). Deshalb fragen Betriebe die Freischaltung
 * an; der Betreiber trägt sie in Meta als Tester ein und gibt sie in der Betreiber-Übersicht frei.
 * Nach der Freigabe durch Meta: WHATSAPP_SIGNUP_OPEN=1 setzen – dann sieht jeder direkt den Verbinden-Knopf.
 */
export type WhatsAppAccess = "open" | "approved" | "requested" | "request";

export function whatsappAccess(profile: Pick<BusinessProfile, "whatsappRequest">, email: string): WhatsAppAccess {
  if (process.env.WHATSAPP_SIGNUP_OPEN === "1" || isPlatformAdmin(email)) return "open";
  if (profile.whatsappRequest?.status === "approved") return "approved";
  if (profile.whatsappRequest) return "requested";
  return "request";
}
