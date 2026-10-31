import { randomInt } from "node:crypto";
import { z } from "zod";
import { apiError, json, parseBody, parseQuery, withSession } from "@/lib/api";
import { CASE_LIMIT_REACHED_TEXT } from "@/lib/billing/limits";
import { attentionOf } from "@/lib/cases/attention";
import { CaseLimitReachedError } from "@/lib/intake/engine";
import { routeInbound } from "@/lib/intake/router";
import { runSimulated } from "@/lib/integrations/outbound";
import { transcribeAudio } from "@/lib/ai/transcribe";

/**
 * Test-Nummern für simulierte WhatsApp-Gespräche: +49000… gibt es nicht – so landet eine Simulation nie in einem Fall
 * eines echten Kunden, und nur solche Fälle lassen sich hier wieder löschen.
 */
const TEST_PREFIX = "+49000";
const testPhone = z.string().trim().regex(/^\+49000\d{4,8}$/, "Nur Test-Nummern (+49000…)");

const schema = z.object({
  /** Fehlt sie, beginnt ein neues Gespräch mit einer zufälligen Test-Nummer. */
  phone: testPhone.optional(),
  name: z.string().trim().max(100).optional(),
  text: z.string().trim().max(1500).default(""),
  /** Sprachnachricht (Base64) statt Text – wird wie bei echtem WhatsApp abgetippt. */
  audio: z.object({ base64: z.string().max(8_000_000), mime: z.string().max(60).default("audio/ogg") }).optional(),
});

/**
 * Simuliert eine eingehende WhatsApp-Nachricht an das eigene Büro: dieselbe Verarbeitung wie eine echte Nachricht
 * (Gespräch, Fragen, Fall, Unterlagen-Hinweis), es wird aber nichts versendet. Für Tests der Branchen-Vorlagen.
 */
export const POST = withSession(
  async (req, { store, session }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const phone = body.data.phone ?? `${TEST_PREFIX}${randomInt(100000, 999999)}`;
    let text = body.data.text;
    let transcript: string | null = null;
    if (body.data.audio) {
      transcript = await transcribeAudio(new Uint8Array(Buffer.from(body.data.audio.base64, "base64")), body.data.audio.mime);
      if (!transcript) return apiError("Die Sprachnachricht konnte nicht abgetippt werden.", 422);
      text = transcript;
    }
    if (!text) return apiError("Text oder Sprachnachricht fehlt", 400);
    try {
      const { turn } = await runSimulated(() =>
        routeInbound(store, { companyId: session.companyId, channel: "whatsapp", text, sender: { phone, name: body.data.name }, simulated: true }),
      );
      const c = await store.getCase(turn.sessionId);
      return json({ phone, transcript, caseId: turn.sessionId, replies: turn.replies, done: turn.done, status: turn.status, service: turn.fields.service ?? "", attention: c ? attentionOf(c.fields) : "", fields: turn.fields });
    } catch (err) {
      if (err instanceof CaseLimitReachedError) return apiError(CASE_LIMIT_REACHED_TEXT, 402);
      throw err;
    }
  },
  { permission: "cases:write", limit: 30 },
);

/** Simuliertes Gespräch (nur Test-Nummern) samt Fall wieder löschen. */
export const DELETE = withSession(
  async (req, { store }) => {
    const q = parseQuery(req, z.object({ phone: testPhone }));
    if (!q.success) return apiError("Nur Test-Nummern (+49000…)", 400);
    const cases = (await store.listCases()).filter((c) => c.fields.phone === q.data.phone);
    for (const c of cases) {
      for (const a of (await store.listAppointments()).filter((x) => x.caseId === c.id)) await store.deleteAppointment(a.id);
      await store.deleteCase(c.id);
    }
    return json({ deleted: cases.length });
  },
  { permission: "cases:write" },
);
