import { apiError, json, withSession } from "@/lib/api";
import { buildPreliminaryAssessment } from "@/lib/ai/preliminary-assessment";
import type { AiImage } from "@/lib/ai/provider";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { readFile } from "@/lib/documents/storage";
import { caseIdSchema } from "@/lib/validation";

const MAX_IMAGES = 4;

/** Büro lässt die KI aus Gebäudedaten, Energieausweis, Grundriss und Fotos eine unverbindliche fachliche
 * Voreinschätzung zur Gesprächsvorbereitung erstellen. Geht nie an den Kunden, nur in die interne Fallhistorie. */
export const POST = withSession(
  async (_req, { store }, ctx: RouteContext<"/api/cases/[id]/preliminary-assessment">) => {
    const { id } = await ctx.params;
    if (!caseIdSchema.safeParse(id).success) return apiError("Nicht gefunden", 404);
    const c = await store.getCase(id);
    if (!c) return apiError("Nicht gefunden", 404);

    const documents = (await store.listDocuments(id)).filter((d) => d.status === "received" && d.storagePath);
    const images: AiImage[] = [];
    let energyCertificateText = "";

    const addImage = async (storagePath: string, mimeType: string) => {
      if (images.length >= MAX_IMAGES || !mimeType.startsWith("image/")) return;
      const file = await readFile(storagePath);
      if (file) images.push({ mime: mimeType, base64: Buffer.from(file.bytes).toString("base64") });
    };

    const energyCert = documents.find((d) => d.kind === "energy_certificate");
    if (energyCert) {
      if (energyCert.mimeType === "application/pdf") {
        const file = await readFile(energyCert.storagePath);
        if (file) energyCertificateText = await extractPdfText(file.bytes);
      } else {
        await addImage(energyCert.storagePath, energyCert.mimeType);
      }
    }

    const floorplan = documents.find((d) => d.kind === "floorplan");
    if (floorplan) await addImage(floorplan.storagePath, floorplan.mimeType);

    for (const photo of documents.filter((d) => d.kind === "photos")) {
      await addImage(photo.storagePath, photo.mimeType);
    }

    const assessment = await buildPreliminaryAssessment({ fields: c.fields, energyCertificateText, images });
    if (!assessment) return apiError("Voreinschätzung konnte nicht erstellt werden (KI nicht konfiguriert oder vorübergehender Fehler).", 503);

    await store.addEvent(id, "assessment", assessment);
    return json({ assessment }, 201);
  },
  { permission: "cases:write" },
);
