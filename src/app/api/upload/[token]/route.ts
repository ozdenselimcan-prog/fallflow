import { z } from "zod";
import { apiError, json, publicRoute } from "@/lib/api";
import { findUploadContext } from "@/lib/data";
import { DOCUMENT_KINDS } from "@/lib/data/types";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, sanitizeFileName, saveFile, sniffMime, storageAvailable } from "@/lib/documents/storage";
import { refreshCase, registerUpload } from "@/lib/intake/case-ops";
import { buildChecklist } from "@/lib/intake/checklist";
import { rateLimit } from "@/lib/rate-limit";

const MAX_DOCS_PER_CASE = 30;

/** Öffentlicher Upload-Link des Kunden: liefert nur, was die Upload-Seite braucht (keine personenbezogenen Falldaten). */
export const GET = publicRoute("upload-info", 60, async (_req, ctx: RouteContext<"/api/upload/[token]">) => {
  const { token } = await ctx.params;
  const found = await findUploadContext(token);
  if (!found) return apiError("Der Link ist ungültig oder abgelaufen.", 404);
  const { store, caseRecord } = found;
  const [questions, documents, company] = await Promise.all([store.listQuestions(), store.listDocuments(caseRecord.id), store.getCompany()]);
  const checklist = buildChecklist({ questions, fields: caseRecord.fields, documents });
  return json({
    companyName: company.name,
    items: checklist.items.filter((i) => i.kind === "document").map((i) => ({ kind: i.key.replace("doc:", ""), label: i.label, required: i.required, done: i.done })),
    uploadsAvailable: storageAvailable(),
  });
});

/**
 * Sicherer Datei-Upload: Token-geprüft, Rate-Limit, max. 10 MB, nur PDF/JPG/PNG/WebP – der Typ wird am Dateiinhalt
 * erkannt (nicht am Namen oder Content-Type). Dateien landen in einem privaten Speicher, nie öffentlich.
 */
export const POST = publicRoute("upload", 20, async (req, ctx: RouteContext<"/api/upload/[token]">) => {
  const { token } = await ctx.params;
  if (!rateLimit(`upload-token:${token.slice(0, 40)}`, 40, 3_600_000)) return apiError("Zu viele Uploads. Bitte später erneut versuchen.", 429);
  const found = await findUploadContext(token);
  if (!found) return apiError("Der Link ist ungültig oder abgelaufen.", 404);
  if (!storageAvailable()) return apiError("Datei-Uploads sind derzeit nicht verfügbar.", 503);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 200_000) return apiError("Die Datei ist zu groß (maximal 10 MB).", 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("Ungültige Anfrage", 400);
  }
  const kind = z.enum(DOCUMENT_KINDS).safeParse(form.get("kind"));
  const file = form.get("file");
  if (!kind.success || !(file instanceof File)) return apiError("Bitte wählen Sie eine Datei aus.", 400);
  if (file.size === 0) return apiError("Die Datei ist leer.", 400);
  if (file.size > MAX_UPLOAD_BYTES) return apiError("Die Datei ist zu groß (maximal 10 MB).", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime) return apiError("Nur PDF, JPG, PNG oder WebP sind erlaubt.", 415);

  const { store, caseRecord } = found;
  if ((await store.listDocuments(caseRecord.id)).length >= MAX_DOCS_PER_CASE) return apiError("Es wurden bereits zu viele Dateien hochgeladen.", 409);

  const storagePath = await saveFile({ companyId: caseRecord.companyId, caseId: caseRecord.id, bytes, mime });
  await registerUpload(store, caseRecord, { kind: kind.data, fileName: sanitizeFileName(file.name, ALLOWED_TYPES[mime]), mimeType: mime, size: bytes.byteLength, storagePath });
  const { checklist } = await refreshCase(store, caseRecord.id, { hint: "edit" });
  return json({ ok: true, kind: kind.data, percent: checklist.percent }, 201);
});
