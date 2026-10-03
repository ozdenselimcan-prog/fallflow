/**
 * OpenAI-kompatibler Provider. Nur serverseitig importieren – der API-Key verlässt den Server nie.
 * Ohne AI_API_KEY liefert getAiProvider() null und die App nutzt den regelbasierten Mock-Extraktor.
 */
export interface AiImage {
  mime: string;
  base64: string;
}

export interface AiProvider {
  /** Liefert das geparste JSON der Modellantwort (ungeprüft!) oder wirft bei Netzwerk-/HTTP-Fehlern. */
  completeJson(system: string, user: string): Promise<unknown>;
  /** Wie completeJson, aber mit Bildern im User-Turn (Vision) – braucht ein bildfähiges Modell (z. B. gpt-4o-mini). */
  completeJsonWithImages(system: string, user: string, images: AiImage[]): Promise<unknown>;
}

/** `modelOverride` erzwingt ein bestimmtes Modell unabhängig von AI_MODEL – z. B. ein günstiges Modell für einfache Ja/Nein-Einschätzungen. */
export function getAiProvider(modelOverride?: string): AiProvider | null {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  const model = modelOverride || process.env.AI_MODEL || "gpt-4o-mini";
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

  async function request(msg: { system: string; user: unknown }, timeoutMs: number): Promise<unknown> {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: msg.system },
          { role: "user", content: msg.user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`AI-Provider antwortete mit HTTP ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI-Provider lieferte keinen Inhalt");
    return JSON.parse(content);
  }

  return {
    completeJson: (system, user) => request({ system, user }, 15_000),
    completeJsonWithImages: (system, user, images) =>
      request(
        {
          system,
          user: [{ type: "text", text: user }, ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } }))],
        },
        30_000,
      ),
  };
}
