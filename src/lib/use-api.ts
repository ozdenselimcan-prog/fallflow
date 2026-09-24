"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export async function apiFetch<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Anfrage fehlgeschlagen");
  return data;
}

/** Führt eine Mutation aus, zeigt Ladezustand/Fehler und lädt anschließend die Server-Daten neu. */
export function useMutation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { refresh?: boolean } = {}): Promise<T | undefined> => {
      setPending(true);
      setError(null);
      try {
        const out = await fn();
        if (opts.refresh !== false) router.refresh();
        return out;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  return { pending, error, setError, run };
}
