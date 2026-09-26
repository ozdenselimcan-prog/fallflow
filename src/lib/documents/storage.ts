import { createAdminClient } from "@/lib/supabase/clients";
import { isSupabaseConfigured } from "@/lib/utils";

/**
 * Sicherer Datei-Speicher für Kundendokumente. Dateien liegen ausschließlich in einem privaten Bucket
 * (Supabase Storage, nur per Service Role erreichbar) bzw. im Demo-Modus im Arbeitsspeicher.
 * Es gibt keine öffentlichen Datei-URLs: Auslieferung nur über die geschützte Route /api/documents/[id].
 */

export const BUCKET = "case-documents";
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type AllowedMime = keyof typeof ALLOWED_TYPES;

/** Erkennt den Dateityp am Inhalt (Magic Bytes) – der vom Client gemeldete Typ wird nie vertraut. */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 5 && at(0) === 0x25 && at(1) === 0x50 && at(2) === 0x44 && at(3) === 0x46 && at(4) === 0x2d) return "application/pdf";
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47 && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return "image/png";
  if (bytes.length >= 12 && at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "image/webp";
  return null;
}

/** Dateiname für Anzeige/Download: keine Pfade, keine Steuerzeichen, begrenzte Länge. */
export function sanitizeFileName(name: string, ext: string): string {
  const base = name
    .replace(/^.*[\\/]/, "")
    .replace(/\.[^.]*$/, "")
    .replace(/[^\p{L}\p{N} ._-]/gu, "_")
    .trim()
    .slice(0, 80);
  return `${base || "Dokument"}.${ext}`;
}

const mem = globalThis as unknown as { __fallflowFiles?: Map<string, { bytes: Uint8Array; mime: string }> };
const memFiles = () => (mem.__fallflowFiles ??= new Map());

export function storageAvailable(): boolean {
  return !isSupabaseConfigured() || createAdminClient() !== null;
}

export async function saveFile(input: { companyId: string; caseId: string; bytes: Uint8Array; mime: AllowedMime }): Promise<string> {
  const path = `${input.companyId}/${input.caseId}/${crypto.randomUUID()}.${ALLOWED_TYPES[input.mime]}`;
  if (!isSupabaseConfigured()) {
    memFiles().set(path, { bytes: input.bytes, mime: input.mime });
    return path;
  }
  const admin = createAdminClient();
  if (!admin) throw new Error("Datei-Speicher ist nicht konfiguriert");
  const { error } = await admin.storage.from(BUCKET).upload(path, input.bytes, { contentType: input.mime, upsert: false });
  if (error) {
    console.error("[storage] Upload fehlgeschlagen:", error.message);
    throw new Error("Datei konnte nicht gespeichert werden");
  }
  return path;
}

export async function readFile(path: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!isSupabaseConfigured()) return memFiles().get(path) ?? null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || "application/octet-stream" };
}

/** Löscht eine Datei aus dem Speicher (z. B. bei der automatischen Löschung alter Anfragen). Fehler werden geloggt, nicht geworfen. */
export async function deleteFile(path: string): Promise<void> {
  if (!path) return;
  if (!isSupabaseConfigured()) {
    memFiles().delete(path);
    return;
  }
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) console.error("[storage] Löschen fehlgeschlagen:", error.message);
}
