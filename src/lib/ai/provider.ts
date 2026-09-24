/**
 * OpenAI-kompatibler Provider. Nur serverseitig importieren – der API-Key verlässt den Server nie.
 * Ohne AI_API_KEY liefert getAiProvider() null und die App nutzt den regelbasierten Mock-Extraktor.
 */
export interface AiProvider {
  /** Liefert das geparste JSON der Modellantwort (ungeprüft!) oder wirft bei Netzwerk-/HTTP-Fehlern. */
  completeJson(system: string, user: string): Promise<unknown>;
}

export function getAiProvider(): AiProvider | null {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    async completeJson(system, user) {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`AI-Provider antwortete mit HTTP ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI-Provider lieferte keinen Inhalt");
      return JSON.parse(content);
    },
  };
}
