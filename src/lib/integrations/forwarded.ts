/**
 * Weiterleitung (z. B. Outlook/Microsoft 365 → Gmail): Wird per „Weiterleitung“ in den Outlook-Einstellungen
 * weitergeleitet, bleibt der Kunde der Absender – dann ist nichts zu tun. Leitet das Büro dagegen per Regel
 * „Weiterleiten“ (WG:) weiter, kommt die Mail scheinbar von der eigenen Büro-Adresse; der echte Kunde steht nur im
 * Text („Von: Max Mustermann <max@example.com>“). Diese Funktion holt Kunde, Betreff und Text wieder heraus.
 */
export interface UnwrappedMail {
  from: string;
  fromName: string;
  subject: string;
  body: string;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const HEADER_LINE = /^\s*\*?(von|from|gesendet|sent|datum|date|an|to|cc|betreff|subject)\s*:\*?\s*(.*)$/i;

export function unwrapForwardedMail(subject: string, body: string): UnwrappedMail | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const fromIdx = lines.findIndex((l) => /^\s*\*?(von|from)\s*:/i.test(l));
  if (fromIdx < 0) return null;
  const fromValue = lines[fromIdx].replace(/^\s*\*?(von|from)\s*:\*?\s*/i, "");
  // Manche Programme schreiben die Adresse in die nächste Zeile ("Von: Max Mustermann" / "max@example.com").
  const address = (fromValue.match(/<([^>\s]+@[^>\s]+)>/)?.[1] ?? fromValue.match(EMAIL)?.[0] ?? lines[fromIdx + 1]?.match(EMAIL)?.[0] ?? "").toLowerCase();
  if (!address) return null;
  const fromName = fromValue.replace(/<[^>]*>|\[mailto:[^\]]*\]/g, "").replace(EMAIL, "").replace(/["']/g, "").trim();

  // Kopfblock (Von/Gesendet/An/Betreff …) überspringen; der Rest ist die eigentliche Nachricht des Kunden.
  let i = fromIdx;
  let originalSubject = "";
  while (i < lines.length && (HEADER_LINE.test(lines[i]) || (i === fromIdx + 1 && EMAIL.test(lines[i])))) {
    const m = lines[i].match(HEADER_LINE);
    if (m && /^(betreff|subject)$/i.test(m[1])) originalSubject = m[2].trim();
    i++;
  }
  const text = lines.slice(i).join("\n").trim();
  const cleanSubject = originalSubject || subject.replace(/^\s*((wg|fw|fwd|weitergeleitet)\s*:\s*)+/i, "").trim();
  return { from: address, fromName, subject: cleanSubject, body: text };
}
