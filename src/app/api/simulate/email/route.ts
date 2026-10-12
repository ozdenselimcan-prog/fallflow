import { randomBytes } from "node:crypto";
import { z } from "zod";
import { apiError, json, parseBody, withSession } from "@/lib/api";
import { CASE_LIMIT_REACHED_TEXT } from "@/lib/billing/limits";
import { attentionOf } from "@/lib/cases/attention";
import { STATUS_LABELS } from "@/lib/cases/fields";
import { MAX_UPLOAD_BYTES, sniffMime } from "@/lib/documents/storage";
import { refreshCase } from "@/lib/intake/case-ops";
import { CaseLimitReachedError } from "@/lib/intake/engine";
import { handleInboundMail } from "@/lib/integrations/inbound-mail";
import { runSimulated } from "@/lib/integrations/outbound";

// Sichtprüfung eingescannter Formulare kann etwas dauern.
export const maxDuration = 60;

const schema = z.object({
  /** Absender; bei preview optional (dann eine zufällige Test-Adresse, damit es immer eine NEUE Anfrage ist). */
  from: z.string().trim().toLowerCase().email().optional(),
  fromName: z.string().trim().max(100).optional(),
  subject: z.string().trim().max(300).default(""),
  body: z.string().max(8000).default(""),
  attachments: z
    .array(z.object({ filename: z.string().trim().min(1).max(200), base64: z.string().max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 8) }))
    .max(5)
    .default([]),
  /** true = "Testmail ausprobieren": zeigt, was der Kunde bekäme, und löscht den Testfall danach wieder. */
  preview: z.boolean().default(false),
  /** Als läge die Mail im Junk-/Spam-Ordner. */
  junk: z.boolean().default(false),
});

/**
 * Test-Simulation einer eingehenden E-Mail für das eigene Büro: läuft durch genau dieselbe Verarbeitung wie eine
 * echte Mail aus dem Postfach (Anfrage-Prüfung, Fall, KI-Antwort, Anhänge) – es wird aber garantiert nichts
 * versendet. Mit preview wird das Ergebnis direkt zurückgegeben und der Testfall anschließend gelöscht.
 */
export const POST = withSession(
  async (req, { store, session }) => {
    const body = await parseBody(req, schema);
    if (!body.ok) return body.res;
    const from = body.data.from ?? (body.data.preview ? `testkunde-${randomBytes(4).toString("hex")}@beispiel.de` : null);
    if (!from) return apiError("Absender fehlt", 400);
    const attachments = body.data.attachments.map((a) => {
      const bytes = new Uint8Array(Buffer.from(a.base64, "base64"));
      return { filename: a.filename, mime: sniffMime(bytes) ?? "application/octet-stream", bytes };
    });
    const accepted = attachments.filter((a) => a.mime !== "application/octet-stream" && a.bytes.length <= MAX_UPLOAD_BYTES);
    const skipped = attachments.filter((a) => !accepted.includes(a)).map((a) => a.filename);
    try {
      const outcome = await runSimulated(() =>
        handleInboundMail(store, session.companyId, { from, fromName: body.data.fromName, subject: body.data.subject, body: body.data.body, attachments: accepted, skippedAttachments: skipped }, { simulated: true, junk: body.data.junk }),
      );
      if (!body.data.preview) return json(outcome);
      if (!outcome.handled) return json({ handled: false });

      // Vorschau zusammenstellen: Antwort an den Kunden, mitgeschickte PDFs, was noch fehlt – dann Testfall löschen.
      const caseId = outcome.caseId;
      const [refreshed, messages, templateDocs, templates] = await Promise.all([
        refreshCase(store, caseId, { touch: false }),
        store.listMessages(caseId),
        store.listTemplateDocuments(caseId),
        store.listDocumentTemplates(),
      ]);
      const c = refreshed.caseRecord;
      const titleOf = new Map(templates.map((t) => [t.id, t.title]));
      const preview = {
        handled: true,
        service: c.fields.service ?? "",
        status: STATUS_LABELS[c.status],
        attention: attentionOf(c.fields),
        reply: messages.filter((m) => m.role === "assistant").map((m) => m.content).join("\n\n"),
        attachments: templateDocs.map((td) => ({ title: titleOf.get(td.templateId) ?? "Vorlage", infoOnly: td.status === "info" })),
        missing: refreshed.checklist.missing.map((i) => i.label),
        appointmentProposed: (await store.listAppointments()).some((a) => a.caseId === caseId),
      };
      for (const a of (await store.listAppointments()).filter((x) => x.caseId === caseId)) await store.deleteAppointment(a.id);
      await store.deleteCase(caseId);
      return json(preview);
    } catch (err) {
      if (err instanceof CaseLimitReachedError) return apiError(CASE_LIMIT_REACHED_TEXT, 402);
      throw err;
    }
  },
  { permission: "cases:write", limit: 20 },
);
