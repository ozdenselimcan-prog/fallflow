"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { applyTurn } from "@/lib/ai/conversation";
import { heuristicExtract } from "@/lib/ai/heuristic";
import { DEFAULT_ASSISTANT } from "@/lib/cases/fields";
import { seedQuestions } from "@/lib/data/seed";
import { Button } from "@/components/ui/button";
import { CasePreview } from "./case-preview";
import { ChatClient, type ChatSendContext, type ChatTurn } from "./chat-client";

const questions = seedQuestions();
const settings = { ...DEFAULT_ASSISTANT, greeting: "Hallo! Wie können wir Ihnen bei Ihrem Gebäude helfen?" };

const SUGGESTIONS: Record<string, string> = {
  __first: "Hallo, ich möchte mein Haus sanieren und brauche einen iSFP.",
  buildingType: "Einfamilienhaus",
  yearBuilt: "1982",
  livingArea: "165",
  heating: "Gas",
  postalCode: "82166",
  name: "Max Mustermann",
  email: "max.mustermann@example.com",
};

/** Komplett lokale Demo (ohne Server/APIs): gleiche Gesprächslogik wie im echten Widget, regelbasierte Extraktion. */
async function demoSend(text: string, ctx: ChatSendContext): Promise<ChatTurn> {
  const turn = applyTurn({ questions, settings, fields: ctx.fields, text, first: ctx.first, extracted: ctx.first ? heuristicExtract(text) : undefined });
  return turn;
}

export function DemoWorkbench({ compact = false }: { compact?: boolean }) {
  const [run, setRun] = useState(0);
  const [state, setState] = useState<{ fields: Record<string, string>; completeness: number }>({ fields: {}, completeness: 0 });
  const onUpdate = useCallback((s: { fields: Record<string, string>; completeness: number }) => setState({ fields: s.fields, completeness: s.completeness }), []);

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex h-[30rem] flex-col overflow-hidden rounded-2xl border border-border shadow-sm sm:h-[34rem]">
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{settings.name} · Website-Chat</p>
              <p className="text-xs text-muted-foreground">Demo – keine echten Daten</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRun((r) => r + 1);
                setState({ fields: {}, completeness: 0 });
              }}
            >
              <RotateCcw className="size-3.5" /> Neu starten
            </Button>
          </div>
          <ChatClient key={run} assistantName={settings.name} greeting={settings.greeting} send={demoSend} onUpdate={onUpdate} suggestions={SUGGESTIONS} className="flex-1" />
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Live entstehender Beratungsfall</p>
          <CasePreview fields={state.fields} completeness={state.completeness} />
          {!compact && (
            <p className="text-xs text-muted-foreground">
              Die Demo läuft vollständig im Browser mit regelbasierter Auswertung. Im Produktivbetrieb kann zusätzlich ein KI-Modell die Freitext-Anfrage auswerten – die Gesprächsführung und Prüfung der Angaben bleiben regelbasiert.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
