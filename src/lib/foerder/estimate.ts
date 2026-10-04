/**
 * Grobe, deterministische Förderschätzung (BAFA/KfW BEG Einzelmaßnahmen) – bewusst KEINE KI-Generierung:
 * Fördersätze sind feste, bekannte Regeln, kein Fall für ein sprachmodellgeneriertes Ergebnis (Risiko
 * erfundener Prozentsätze). Immer nur eine grobe Orientierung, nie eine verbindliche Förderzusage –
 * der Energieberater prüft und bestätigt den Text, bevor er an den Kunden geht (siehe API-Route).
 */

const ELIGIBLE_SERVICES = ["Heizung", "Einzelmaßnahme", "Sanierung", "Fördermittelberatung"];
const FOSSIL_HEATING = ["Gas", "Öl"];

export interface FoerderEstimate {
  minPercent: number;
  maxPercent: number;
  bullets: string[];
}

/** null = für diesen Fall aktuell keine sinnvolle automatische Schätzung möglich. */
export function estimateFoerderung(fields: Record<string, string>): FoerderEstimate | null {
  const service = fields.service ?? "";
  if (!ELIGIBLE_SERVICES.includes(service)) return null;
  // Antragsteller bei der BEG-Heizungsförderung muss i. d. R. Eigentümer sein.
  if (fields.ownerStatus === "Mieter") return null;

  let max = 30;
  const bullets = ["Grundförderung: 30 % der förderfähigen Kosten."];

  if (FOSSIL_HEATING.includes(fields.heating ?? "")) {
    max += 20;
    bullets.push("Geschwindigkeitsbonus: bis zu 20 % zusätzlich beim Austausch einer funktionierenden Öl-/Gasheizung – der genaue Satz hängt vom Zeitpunkt ab und ist im Gespräch zu klären.");
  }

  max += 30;
  bullets.push("Einkommensbonus: weitere 30 % möglich bei selbstgenutztem Eigentum und zu versteuerndem Haushaltseinkommen bis 40.000 €/Jahr.");

  max = Math.min(max, 70);
  bullets.push("Maximal kombinierbar: 70 % der förderfähigen Kosten, gedeckelt auf 30.000 € förderfähige Kosten (Einfamilienhaus, erste Wohneinheit).");

  return { minPercent: 30, maxPercent: max, bullets };
}

export function foerderDraftText(customerName: string, estimate: FoerderEstimate): string {
  const greeting = customerName.trim() ? `Guten Tag ${customerName.trim()},` : "Guten Tag,";
  return [
    greeting,
    "",
    `nach einer ersten groben Einschätzung Ihrer Angaben könnten für Ihr Vorhaben zwischen ${estimate.minPercent} % und ${estimate.maxPercent} % Förderung über BAFA/KfW infrage kommen:`,
    "",
    ...estimate.bullets.map((b) => `• ${b}`),
    "",
    "Wichtig: Das ist eine unverbindliche Erst-Einschätzung, keine Förderzusage. Die genauen Werte klären wir gemeinsam im persönlichen Gespräch.",
    "",
    "Viele Grüße",
  ].join("\n");
}
