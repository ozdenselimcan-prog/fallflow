import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Logo mit Schriftzug einmal beim Laden lesen (hängt nicht von der Anfrage ab).
const logoSrc = `data:image/png;base64,${await readFile(join(process.cwd(), "public/brand/logo-full.png"), "base64")}`;

export const alt = "FallFlow – Aus jeder Kundenanfrage einen fertigen Beratungsfall";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Vorschaubild beim Teilen der Seite (WhatsApp, LinkedIn, E-Mail …). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#ffffff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse rendert nur <img> */}
          <img src={logoSrc} height={64} alt="FallFlow" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, color: "#0a0a0a", letterSpacing: -2 }}>Aus jeder Kundenanfrage einen fertigen Beratungsfall.</div>
          <div style={{ fontSize: 30, color: "#5c5c5c" }}>KI-Assistent für Energieberater: beantwortet E-Mails, sammelt Unterlagen, bereitet Fälle vor.</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["E-Mail-Automatisierung", "Fallakte", "Terminvorschlag", "Website-Chat"].map((t) => (
            <div key={t} style={{ fontSize: 24, padding: "10px 20px", borderRadius: 999, background: "#f2f2f2", color: "#0a0a0a" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
