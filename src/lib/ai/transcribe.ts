/**
 * Sprachnachrichten abtippen (WhatsApp): Audio an die Transkription des KI-Anbieters (OpenAI) schicken und den Text
 * zurückgeben. Die Sprache wird automatisch erkannt. Ohne KI-Schlüssel oder bei Fehlern: null (dann bittet FallFlow den
 * Kunden, kurz zu schreiben).
 */
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const EXT: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "m4a",
  "audio/amr": "amr",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

export async function transcribeAudio(bytes: Uint8Array, mime: string): Promise<string | null> {
  const key = process.env.AI_API_KEY;
  if (!key || !bytes.length || bytes.length > MAX_AUDIO_BYTES) return null;
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const type = mime.split(";")[0].trim().toLowerCase() || "audio/ogg";
  const form = new FormData();
  form.append("file", new Blob([bytes.slice().buffer as ArrayBuffer], { type }), `sprachnachricht.${EXT[type] ?? "ogg"}`);
  form.append("model", process.env.AI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  try {
    const res = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(45_000) });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      console.error(`[ai] Transkription fehlgeschlagen: HTTP ${res.status} ${err.error?.code ?? ""}`);
      return null;
    }
    const body = (await res.json()) as { text?: string };
    const text = (body.text ?? "").replace(/\s+/g, " ").trim();
    return text || null;
  } catch (err) {
    console.error("[ai] Transkription fehlgeschlagen:", err instanceof Error ? err.message : "unbekannt");
    return null;
  }
}
