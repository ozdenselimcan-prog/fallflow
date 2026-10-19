"use client";

import { useEffect, useState } from "react";

/**
 * Tippt einen Text beim Laden Buchstabe für Buchstabe ein (mit blinkendem Cursor). Der volle Text ist von Anfang an da –
 * unsichtbar, damit nichts springt, und für Screenreader/Suchmaschinen lesbar. Bei "Bewegung reduzieren" sofort komplett.
 */
export function TypedText({ text, startDelay = 450, speed = 42 }: { text: string; startDelay?: number; speed?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = setTimeout(() => setCount(text.length), 0);
      return () => clearTimeout(timer);
    }
    const tick = (n: number) => {
      setCount(n);
      if (n < text.length) timer = setTimeout(() => tick(n + 1), speed);
    };
    timer = setTimeout(() => {
      setStarted(true);
      tick(1);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [text, startDelay, speed]);

  const done = count >= text.length;
  return (
    <span className="relative inline-block">
      <span className="invisible">{text}</span>
      <span aria-hidden className="absolute inset-0">
        {text.slice(0, count)}
        {started && <span className={`typed-cursor ${done ? "typed-cursor-done" : ""}`} />}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
