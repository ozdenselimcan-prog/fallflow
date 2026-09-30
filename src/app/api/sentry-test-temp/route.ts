// Temporär: einmaliger Test, ob Sentry eingehende Fehler tatsächlich empfängt. Danach wieder entfernt.
export async function GET() {
  throw new Error("FallFlow Sentry-Testfehler – kann ignoriert/gelöscht werden");
}
