import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { CASE_LIMIT_REACHED_TEXT } from "@/lib/billing/limits";
import { MAX_UPLOAD_BYTES, sniffMime } from "@/lib/documents/storage";
import { CaseLimitReachedError } from "@/lib/intake/engine";
import { handleInboundMail } from "@/lib/integrations/inbound-mail";
import { runSimulated } from "@/lib/integrations/outbound";

const schema = z.object({
  from: z.string().trim().toLowerCase().email(),
  fromName: z.string().trim().max(100).optional(),
  subject: z.string().trim().max(300).default(""),
  body: z.string().max(8000).default(""),
  attachments: z
    .array(z.object({ filename: z.string().trim().min(1).max(200), base64: z.string().max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8) }))
    .max(5)
    .default([]),
});

/**
 * Test-Simulation einer eingehenden E-Mail für das eigene Büro: läuft durch genau dieselbe Verarbeitung wie eine
 * echte Mail aus dem Postfach (Anfrage-Prüfung, Fall, KI-Antwort, Anhänge) – es wird aber garantiert nichts
 * versendet. Die KI-Antworten stehen anschließend im Fall (als "Simulation").
 */
export const POST = withSession(
  async (req, { store, session }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const attachments = body.data.attachments.map((a) => {
      const bytes = new Uint8Array(Buffer.from(a.base64, "base64"));
      return { filename: a.filename, mime: sniffMime(bytes) ?? "application/octet-stream", bytes };
    });
    const accepted = attachments.filter((a) => a.mime !== "application/octet-stream" && a.bytes.length <= MAX_UPLOAD_BYTES);
    const skipped = attachments.filter((a) => !accepted.includes(a)).map((a) => a.filename);
    try {
      const outcome = await runSimulated(() =>
        handleInboundMail(store, session.companyId, { from: body.data.from, fromName: body.data.fromName, subject: body.data.subject, body: body.data.body, attachments: accepted, skippedAttachments: skipped }, { simulated: true }),
      );
      return json(outcome);
    } catch (err) {
      if (err instanceof CaseLimitReachedError) return apiError(CASE_LIMIT_REACHED_TEXT, 402);
      throw err;
    }
  },
  { permission: "cases:write", limit: 20 },
);
