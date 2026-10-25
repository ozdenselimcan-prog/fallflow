"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Nur am Handy: Sobald man am Anfang der Seite vorbeigescrollt ist, bleibt unten „7 Tage kostenlos testen“ sichtbar –
 * die Startseite ist dort sehr lang, ohne diesen Knopf muss man für die Anmeldung weit zurückscrollen.
 */
export function MobileCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 650);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      <div aria-hidden className="h-20 lg:hidden" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 lg:hidden",
          show ? "translate-y-0" : "translate-y-full",
        )}
      >
        <Link href="/signup" className={buttonStyles({ size: "lg", className: "w-full" })}>
          7 Tage kostenlos testen
        </Link>
        <p className="mt-1.5 text-center text-xs text-muted-foreground">Ohne Kreditkarte · monatlich kündbar</p>
      </div>
    </>
  );
}
