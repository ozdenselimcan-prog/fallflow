import { z } from "zod";
import { apiError, json, parseBody, publicRoute } from "@/lib/api";
import { siteConfig } from "@/lib/config/site";
import { sendResendMail } from "@/lib/integrations/forward-send";

/** Anfrage für eine persönliche Einrichtung am Telefon (Seite /einrichtung) – geht per Mail an den Support. */
const schema = z.object({
  name: z.string().trim().min(2, "Bitte Ihren Namen angeben").max(100),
  company: z.string().trim().min(2, "Bitte den Namen Ihres Betriebs angeben").max(120),
  phone: z.string().trim().min(5, "Bitte eine Telefonnummer angeben").max(40),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben").max(200),
  industry: z.string().trim().max(80).optional().default(""),
  when: z.string().trim().max(200).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
  /** Unsichtbares Feld gegen Spam-Bots: Menschen lassen es leer. */
  website: z.string().max(0).optional(),
});

export const POST = publicRoute("setup-request", 5, async (req) => {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.res;
  const d = body.data;
  const text = [
    "Neue Anfrage für eine persönliche Einrichtung:",
    "",
    `Name: ${d.name}`,
    `Betrieb: ${d.company}`,
    `Branche: ${d.industry || "–"}`,
    `Telefon: ${d.phone}`,
    `E-Mail: ${d.email}`,
    `Wann am besten erreichbar: ${d.when || "–"}`,
    "",
    d.note ? `Nachricht:\n${d.note}` : "Keine Nachricht.",
  ].join("\n");
  try {
    await sendResendMail({ fromName: "FallFlow Einrichtung", to: siteConfig.supportEmail, replyTo: [d.email], subject: `Einrichtung gewünscht: ${d.company}`, text });
  } catch (err) {
    console.error("[setup-request] Versand fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return apiError(`Die Anfrage konnte gerade nicht gesendet werden. Bitte schreiben Sie uns an ${siteConfig.supportEmail}.`, 502);
  }
  return json({ ok: true });
});
