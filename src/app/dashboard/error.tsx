"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard]", error.digest ?? error.message);
  }, [error]);
  return <ErrorState title="Die Seite konnte nicht geladen werden" description="Bitte versuchen Sie es erneut. Besteht das Problem weiter, prüfen Sie die Datenbankverbindung." onRetry={reset} />;
}
