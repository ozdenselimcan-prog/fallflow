import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { routeInbound } from "@/lib/intake/router";
import { simulateInboundSchema } from "@/lib/validation";

/**
 * Simulator für den Posteingang: spielt eine eingehende WhatsApp-/E-Mail-Nachricht durch die echte Verarbeitung
 * (Kunde erkennen → Fall zuordnen → fehlende Angaben erkennen → KI antwortet). Alles ist als Simulation markiert,
 * es wird nichts an einen echten Kanal gesendet.
 */
export const POST = withSession(
  async (req, { store }) => {
    const body = await parseBody(req, simulateInboundSchema);
    if (!body.ok) return body.res;
    const { channel, sender, name, text } = body.data;
    if (channel === "email" && !z.string().email().safeParse(sender).success) return apiError("Bitte eine gültige E-Mail-Adresse eingeben.", 400);
    if (channel === "whatsapp" && sender.replace(/\D/g, "").length < 6) return apiError("Bitte eine gültige Telefonnummer eingeben.", 400);

    const { turn, matchedExisting } = await routeInbound(store, {
      channel,
      text,
      simulated: true,
      sender: channel === "email" ? { email: sender, name } : { phone: sender, name },
    });
    return json({ caseId: turn.sessionId, matchedExisting, created: turn.created, replies: turn.replies, status: turn.status, completeness: turn.completeness }, 201);
  },
  { permission: "cases:write", limit: 30 },
);
