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
  /** Wie completeJson, aber mit einer PDF-Datei im User-Turn – das Modell sieht die Seiten wie ein Mensch (auch Scans und Handschrift). */
  completeJsonWithPdf(system: string, user: string, pdf: { filename: string; base64: string }): Promise<unknown>;
}

/** `modelOverride` erzwingt ein bestimmtes Modell unabhängig von AI_MODEL – z. B. ein günstiges Modell für einfache Ja/Nein-Einschätzungen. */
export function getAiProvider(modelOverride?: string): AiProvider | null {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  const model = modelOverride || process.env.AI_MODEL || "gpt-4o-mini";
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

  async function request(msg: { system: string; user: unknown }, timeoutMs: number): Promise<unknown> {
    // Der JSON-Modus von OpenAI verlangt das Wort "JSON" in den Anweisungen (sonst HTTP 400) – sicherheitshalber ergänzen.
    const system = /json/i.test(msg.system) ? msg.system : `${msg.system}\nAntworte als JSON.`;
    const deadline = Date.now() + timeoutMs;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: msg.user },
          ],
        }),
        signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
      });
      // Kurzzeitig zu viele Anfragen (Rate-Limit) oder Server überlastet: kurz warten und erneut versuchen.
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1), 8_000);
        if (Date.now() + wait < deadline - 2_000) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
      }
      if (!res.ok) throw new Error(`AI-Provider antwortete mit HTTP ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI-Provider lieferte keinen Inhalt");
      return JSON.parse(content);
    }
  }

  return {
    completeJson: (system, user) => request({ system, user }, 15_000),
    completeJsonWithImages: (system, user, images) =>
      request(
        {
          system,
          user: [{ type: "text", text: user }, ...images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}`, detail: "high" } }))],
        },
        60_000,
      ),
    completeJsonWithPdf: (system, user, pdf) =>
      request(
        {
          system,
          user: [
            { type: "text", text: user },
            { type: "file", file: { filename: pdf.filename, file_data: `data:application/pdf;base64,${pdf.base64}` } },
          ],
        },
        60_000,
      ),
  };
}
