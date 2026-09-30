"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";

/** Fängt Fehler auf, die selbst das Root-Layout zum Absturz bringen – meldet sie an Sentry (falls konfiguriert). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="text-sm text-muted-foreground">Der Fehler wurde gemeldet. Bitte laden Sie die Seite neu.</p>
        <button type="button" onClick={reset} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white">
          Erneut versuchen
        </button>
      </body>
    </html>
  );
}
