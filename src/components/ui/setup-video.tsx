"use client";

import { PlayCircle } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const SETUP_VIDEO = { src: "/videos/flowdesk-einrichtung.mp4", poster: "/videos/flowdesk-einrichtung.jpg", length: "1:45 Min." };

/** Das Einrichtungs-Video selbst (liegt auf der eigenen Website – kein YouTube, keine Cookies). */
export function SetupVideoPlayer({ autoPlay = false, className }: { autoPlay?: boolean; className?: string }) {
  return (
    <video
      src={SETUP_VIDEO.src}
      poster={SETUP_VIDEO.poster}
      controls
      playsInline
      preload="metadata"
      autoPlay={autoPlay}
      className={cn("aspect-video w-full rounded-xl border border-border bg-black", className)}
    >
      Ihr Browser kann dieses Video nicht abspielen.
    </video>
  );
}

/** Knopf „Video ansehen“ – öffnet das Einrichtungs-Video in einem Fenster. */
export function SetupVideoButton({ label = "Video ansehen", className }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex items-center gap-2 text-sm font-medium hover:underline", className)}>
        <PlayCircle className="size-5" aria-hidden /> {label} <span className="font-normal text-muted-foreground">({SETUP_VIDEO.length})</span>
      </button>
      <Dialog wide open={open} onClose={() => setOpen(false)} title="So richten Sie FallFlow ein">
        {open && <SetupVideoPlayer autoPlay />}
      </Dialog>
    </>
  );
}
