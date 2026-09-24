"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ChatTurn {
  replies: string[];
  quickReplies: string[];
  done: boolean;
  completeness: number;
  fields?: Record<string, string>;
  sessionId?: string | null;
  pendingKey?: string | null;
}

export interface ChatSendContext {
  first: boolean;
  fields: Record<string, string>;
  sessionId: string | null;
}

interface Message {
  id: number;
  role: "assistant" | "user";
  text: string;
}

interface Props {
  assistantName: string;
  greeting: string;
  send: (text: string, ctx: ChatSendContext) => Promise<ChatTurn>;
  /** Wird nach jedem Zug mit den bisher erfassten Feldern aufgerufen (für die Live-Fallvorschau). */
  onUpdate?: (state: { fields: Record<string, string>; completeness: number; done: boolean; started: boolean }) => void;
  /** Beispielantworten (Demo): Schlüssel = pendingKey bzw. "__first" für die erste Nachricht. */
  suggestions?: Record<string, string>;
  className?: string;
}

const ERROR_TEXT = "Der Assistent konnte die Anfrage gerade nicht verarbeiten. Bitte versuchen Sie es erneut.";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ChatClient({ assistantName, greeting, send, onUpdate, suggestions, className }: Props) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "assistant", text: greeting }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string } | null>(null);
  const [quick, setQuick] = useState<string[]>([]);
  const [pendingKey, setPendingKey] = useState<string | null>("__first");
  const [done, setDone] = useState(false);
  const stateRef = useRef<{ fields: Record<string, string>; sessionId: string | null; started: boolean; nextId: number }>({ fields: {}, sessionId: null, started: false, nextId: 1 });
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, quick]);

  const submit = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      const st = stateRef.current;
      setError(null);
      setInput("");
      setQuick([]);
      setMessages((m) => [...m, { id: st.nextId++, role: "user", text }]);
      setBusy(true);
      try {
        const [turn] = await Promise.all([send(text, { first: !st.started, fields: st.fields, sessionId: st.sessionId }), sleep(350)]);
        st.started = true;
        if (turn.fields) st.fields = turn.fields;
        if (turn.sessionId !== undefined) st.sessionId = turn.sessionId;
        setMessages((m) => [...m, ...turn.replies.map((t) => ({ id: st.nextId++, role: "assistant" as const, text: t }))]);
        setQuick(turn.quickReplies);
        setPendingKey(turn.pendingKey ?? null);
        setDone(turn.done);
        onUpdate?.({ fields: st.fields, completeness: turn.completeness, done: turn.done, started: true });
      } catch {
        setError({ text });
        setMessages((m) => m.slice(0, -1));
      } finally {
        setBusy(false);
      }
    },
    [busy, send, onUpdate],
  );

  const suggestion = suggestions?.[done ? "" : (pendingKey ?? "")] ;

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={cn("ff-fade-in flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line",
                m.role === "user" ? "rounded-br-md bg-accent text-white" : "rounded-bl-md bg-muted text-foreground",
              )}
            >
              {m.role === "assistant" && m.id === 0 && <span className="mb-0.5 block text-xs font-medium text-muted-foreground">{assistantName}</span>}
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start" aria-label={`${assistantName} schreibt`}>
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
            {ERROR_TEXT}{" "}
            <button type="button" className="font-medium underline" onClick={() => submit(error.text)}>
              Erneut versuchen
            </button>
          </div>
        )}
      </div>

      {(quick.length > 0 || (suggestion && !busy)) && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {quick.map((q) => (
            <button key={q} type="button" disabled={busy} onClick={() => submit(q)} className="rounded-full border border-accent/40 bg-card px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent-soft disabled:opacity-50">
              {q}
            </button>
          ))}
          {suggestion && !busy && (
            <button type="button" onClick={() => submit(suggestion)} className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
              Beispiel: {suggestion}
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1500}
          placeholder={done ? "Weitere Nachricht …" : "Ihre Nachricht …"}
          aria-label="Ihre Nachricht"
          className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-accent sm:text-sm"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Senden" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-hover disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
        </button>
      </form>
    </div>
  );
}
