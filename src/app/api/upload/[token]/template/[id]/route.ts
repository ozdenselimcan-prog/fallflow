import { NextResponse } from "next/server";
import { apiError, publicRoute } from "@/lib/api";
import { findUploadContext } from "@/lib/data";
import { readFile } from "@/lib/documents/storage";

/**
 * Öffentlicher Download einer Büro-PDF-Vorlage (z. B. Vollmacht) – über denselben persönlichen,
 * zeitlich befristeten Link wie der Dokumenten-Upload des Kunden. Kein separates Token nötig.
 */
export const GET = publicRoute("template-download", 60, async (_req, ctx: RouteContext<"/api/upload/[token]/template/[id]">) => {
  const { token, id } = await ctx.params;
  const found = await findUploadContext(token);
  if (!found) return apiError("Der Link ist ungültig oder abgelaufen.", 404);

  const { store } = found;
  const template = (await store.listDocumentTemplates()).find((t) => t.id === id);
  if (!template) return apiError("Nicht gefunden", 404);
  const file = await readFile(template.storagePath);
  if (!file) return apiError("Datei nicht verfügbar", 404);

  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(template.fileName)}`,
      "Content-Length": String(file.bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
