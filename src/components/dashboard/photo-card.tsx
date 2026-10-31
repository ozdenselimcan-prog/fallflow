"use client";

import { Camera, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/states";
import { apiFetch } from "@/lib/use-api";

interface Note {
  text: string;
  docIds: string[];
  at: string;
}

/**
 * Foto-Einschätzung im Fall (nur intern): Sobald neue Kundenfotos da sind, wertet die KI sie beim Öffnen des Falls
 * einmal aus. Der Text lässt sich bearbeiten; „Neu auswerten“ erstellt ihn auf Wunsch neu.
 */
export function PhotoCard({ caseId, canWrite }: { caseId: string; canWrite: boolean }) {
  const [note, setNote] = useState<Note | null>(null);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState(0);
  const [busy, setBusy] = useState<"assess" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const assess = async () => {
    setBusy("assess");
    setError(null);
    try {
      const r = await apiFetch<{ note: Note }>("POST", `/api/cases/${caseId}/photo-assessment`);
      setNote(r.note);
      setText(r.note.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auswertung fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    apiFetch<{ note: Note | null; photos: number; unassessed: number }>("GET", `/api/cases/${caseId}/photo-assessment`)
      .then((r) => {
        setNote(r.note);
        setText(r.note?.text ?? "");
        setPhotos(r.photos);
        // Neue Fotos seit der letzten Auswertung: einmal automatisch auswerten.
        if (r.unassessed > 0 && canWrite && !autoRan.current) {
          autoRan.current = true;
          void assess();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, canWrite]);

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const r = await apiFetch<{ note: Note }>("PUT", `/api/cases/${caseId}/photo-assessment`, { text });
      setNote(r.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(null);
    }
  };

  if (!photos) return null;
  return (
    <Card>
      <CardHeader
        title="Foto-Einschätzung"
        description={`KI-Blick auf ${photos === 1 ? "das Foto" : `die ${photos} Fotos`} des Kunden – nur für Sie, nicht für den Kunden.`}
        action={
          canWrite && (
            <Button size="sm" variant="secondary" onClick={assess} loading={busy === "assess"}>
              <Sparkles className="size-4" /> {note ? "Neu auswerten" : "Auswerten"}
            </Button>
          )
        }
      />
      <div className="space-y-3 p-5 text-sm">
        {error && <Notice tone="error">{error}</Notice>}
        {busy === "assess" && !note && <p className="text-muted-foreground">Die KI schaut sich die Fotos an …</p>}
        {note ? (
          <>
            <Textarea rows={5} value={text} disabled={!canWrite} onChange={(e) => setText(e.target.value)} aria-label="Foto-Einschätzung" />
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && (
                <Button size="sm" variant="secondary" onClick={save} loading={busy === "save"} disabled={text === note.text}>
                  Speichern
                </Button>
              )}
              <span className="text-xs text-muted-foreground">Unverbindlich – ersetzt keine Prüfung vor Ort. Fließt in den Angebots-Entwurf ein.</span>
            </div>
          </>
        ) : (
          busy !== "assess" && (
            <div className="flex items-start gap-3 text-muted-foreground">
              <Camera className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>Noch nicht ausgewertet.</p>
            </div>
          )
        )}
      </div>
    </Card>
  );
}
