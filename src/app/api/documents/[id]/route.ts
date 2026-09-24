import { NextResponse } from "next/server";
import { apiError, withSession } from "@/lib/api";
import { readFile } from "@/lib/documents/storage";

/** Geschützter Download: nur für angemeldete Mitglieder des Büros (Store filtert nach Company bzw. RLS). */
export const GET = withSession(async (_req, { store }, ctx: RouteContext<"/api/documents/[id]">) => {
  const { id } = await ctx.params;
  const doc = await store.getDocument(id);
  if (!doc || doc.status !== "received" || !doc.storagePath) return apiError("Nicht gefunden", 404);
  const file = await readFile(doc.storagePath);
  if (!file) return apiError("Datei nicht verfügbar", 404);
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName || "Dokument")}`,
      "Content-Length": String(file.bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});
