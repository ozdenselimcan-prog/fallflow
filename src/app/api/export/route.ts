import { NextResponse } from "next/server";
import { withSession } from "@/lib/api";
import { buildCompanyExport } from "@/lib/billing/export";

// Viele Dokumente einzusammeln kann etwas dauern.
export const maxDuration = 60;

/** "Alle Daten exportieren": ZIP mit allen Fällen, Fallakten, Dokumenten, Terminen und Vorlagen des Büros. */
export const GET = withSession(
  async (_req, { store }) => {
    const zip = await buildCompanyExport(store);
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="fallflow-export-${day}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { permission: "company:manage", limit: 5 },
);
