"use client";

import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface UploadItem {
  kind: string;
  label: string;
  required: boolean;
  done: boolean;
}

interface Props {
  token: string;
  items: UploadItem[];
  /** false = Speicher nicht konfiguriert → Upload deaktiviert und klar erklärt */
  uploadsAvailable?: boolean;
  onUploaded?: (kind: string) => void;
  className?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;

/** Sicherer Datei-Upload für Kunden (Upload-Seite und Website-Chat). Prüft Größe vorab; der Server prüft den Dateityp am Inhalt. */
export function UploadPanel({ token, items, uploadsAvailable = true, onUploaded, className }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>(Object.fromEntries(items.map((i) => [i.kind, i.done])));
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function upload(kind: string, file: File | undefined) {
    if (!file) return;
    setErrors((e) => ({ ...e, [kind]: "" }));
    if (file.size > MAX_BYTES) return setErrors((e) => ({ ...e, [kind]: "Die Datei ist zu groß (maximal 10 MB)." }));
    setBusy(kind);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const res = await fetch(`/api/upload/${encodeURIComponent(token)}`, { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Der Upload ist fehlgeschlagen.");
      setDone((d) => ({ ...d, [kind]: true }));
      onUploaded?.(kind);
    } catch (err) {
      setErrors((e) => ({ ...e, [kind]: err instanceof Error ? err.message : "Der Upload ist fehlgeschlagen." }));
    } finally {
      setBusy(null);
      const input = inputs.current[kind];
      if (input) input.value = "";
    }
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => (
        <li key={item.kind} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                {done[item.kind] ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden /> : <FileUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                {item.label}
                {!item.required && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{done[item.kind] ? "Erhalten – vielen Dank." : "PDF, JPG, PNG oder WebP · max. 10 MB"}</p>
            </div>
            <label
              className={cn(
                "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-muted focus-within:outline-2 focus-within:outline-accent",
                (busy !== null || !uploadsAvailable) && "pointer-events-none opacity-50",
              )}
            >
              {busy === item.kind && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {done[item.kind] ? "Weitere Datei" : "Datei wählen"}
              <input
                ref={(el) => {
                  inputs.current[item.kind] = el;
                }}
                type="file"
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                disabled={busy !== null || !uploadsAvailable}
                onChange={(e) => void upload(item.kind, e.target.files?.[0])}
                aria-label={`${item.label} hochladen`}
              />
            </label>
          </div>
          {errors[item.kind] && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {errors[item.kind]}
            </p>
          )}
        </li>
      ))}
      {!uploadsAvailable && <li className="text-xs text-muted-foreground">Datei-Uploads sind derzeit nicht verfügbar. Bitte senden Sie die Unterlagen an Ihr Beratungsbüro.</li>}
    </ul>
  );
}
