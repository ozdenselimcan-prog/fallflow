"use client";

import { useCallback } from "react";
import { ChatClient, type ChatSendContext, type ChatTurn } from "./chat-client";

interface Props {
  companyId: string;
  assistantName: string;
  greeting: string;
}

/** Chat im eingebetteten Widget: jede Nachricht geht an /api/widget/message, der Fall wird serverseitig geführt. */
export function WidgetChat({ companyId, assistantName, greeting }: Props) {
  const send = useCallback(
    async (text: string, ctx: ChatSendContext): Promise<ChatTurn> => {
      // Nur echte Einbindungen (Skript erzeugt einen iframe auf der Website des Büros) zählen als
      // "verbunden" – wird diese Seite direkt aufgerufen (z. B. über den Vorschau-Link im Onboarding),
      // ist das Fenster sein eigenes Top-Level-Fenster, kein iframe.
      const embedded = window.self !== window.top;
      const res = await fetch("/api/widget/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, sessionId: ctx.sessionId, text, embedded }),
      });
      if (!res.ok) throw new Error("widget request failed");
      return (await res.json()) as ChatTurn;
    },
    [companyId],
  );

  return <ChatClient assistantName={assistantName} greeting={greeting} send={send} className="h-dvh" />;
}
