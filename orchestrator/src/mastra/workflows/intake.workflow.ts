import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { appelerToolIntake } from "../tools/intake.tools.js";

// ===== Workflow intake documentaire =====
// Pipeline déterministe : réception → OCR → classification → extraction → rattachement → contrôle.
// Toute la logique métier vit dans les tools MCP ; le workflow ne fait qu'orchestrer.
//
// Gestion d'échec : si une étape d'enrichissement échoue (OCR illisible, LLM en panne...),
// les étapes suivantes sont sautées (flag "bloque") mais le contrôle final s'exécute TOUJOURS
// sur l'état réel de la pièce en base — c'est lui qui décide PRET ou ANOMALIE (source unique
// de vérité, décision G.3).

// ----- Schémas -----

const workflowInput = z.object({
  cabinet_id: z.string().uuid(),
  client_id: z.string().uuid(),
  fichier_url: z.string().url(),
  fichier_nom: z.string().min(1).max(255),
  fichier_type: z.enum(["pdf", "jpeg", "png", "webp"]),
  source: z.literal("upload"),
});

// État qui circule de step en step
const etatPiece = z.object({
  cabinet_id: z.string().uuid(),
  piece_id: z.string().uuid(),
  bloque: z.boolean(),
  code_blocage: z.string().nullable(),
});

const workflowOutput = z.object({
  piece_id: z.string(),
  statut: z.enum(["PRET", "ANOMALIE"]),
  controle_code: z.string().nullable(),
  erreurs_count: z.number(),
  warnings_count: z.number(),
});

// ----- Steps -----
// (l'appel des tools MCP — appelerToolIntake — est partagé avec le workflow
// recontrole, défini dans ../tools/intake.tools.ts)

// Step 1 : créer la pièce en base (statut RECU)
const recevoirFichier = createStep({
  id: "recevoir-fichier",
  description: "Crée la pièce en statut RECU à partir du fichier uploadé",
  inputSchema: workflowInput,
  outputSchema: etatPiece,
  execute: async ({ inputData }) => {
    const res = await appelerToolIntake("recevoir_fichier", inputData);
    if (!res.success || !res.data?.piece_id) {
      // Pas de pièce créée → rien à contrôler, le run échoue avec une erreur claire
      throw new Error(
        `Réception du fichier impossible: ${res.error?.code ?? "ERREUR"} — ${res.error?.message ?? ""}`,
      );
    }
    return {
      cabinet_id: inputData.cabinet_id,
      piece_id: res.data.piece_id as string,
      bloque: false,
      code_blocage: null,
    };
  },
});

// Steps 2 à 5 : enrichissement — tous identiques dans leur forme (règle : un seul code
// pour un même comportement). En cas d'échec du tool, on marque "bloque" et on laisse
// le contrôle final constater l'état réel de la pièce.
function stepEnrichissement(id: string, suffixeTool: string) {
  return createStep({
    id,
    description: `Appelle le tool MCP intake_${suffixeTool}`,
    inputSchema: etatPiece,
    outputSchema: etatPiece,
    execute: async ({ inputData }) => {
      if (inputData.bloque) return inputData;

      const res = await appelerToolIntake(suffixeTool, {
        cabinet_id: inputData.cabinet_id,
        piece_id: inputData.piece_id,
      });
      if (!res.success) {
        return {
          ...inputData,
          bloque: true,
          code_blocage: res.error?.code ?? "ERREUR",
        };
      }
      return inputData;
    },
  });
}

const analyserOcr = stepEnrichissement("analyser-ocr", "analyser_ocr");
const classifier = stepEnrichissement("classifier", "classifier");
const extraireDonnees = stepEnrichissement("extraire-donnees", "extraire_donnees");
const rattacher = stepEnrichissement("rattacher", "rattacher");

// Step 6 : contrôle final — s'exécute TOUJOURS, c'est lui qui fixe le statut en base
const controler = createStep({
  id: "controler",
  description: "Exécute toutes les règles de contrôle et fixe le statut final (PRET/ANOMALIE)",
  inputSchema: etatPiece,
  outputSchema: workflowOutput,
  execute: async ({ inputData }) => {
    const res = await appelerToolIntake("controler", {
      cabinet_id: inputData.cabinet_id,
      piece_id: inputData.piece_id,
    });
    if (!res.success || !res.data) {
      throw new Error(
        `Contrôle final impossible: ${res.error?.code ?? "ERREUR"} — ${res.error?.message ?? ""}`,
      );
    }
    // Le code d'anomalie vient du verdict du contrôle (première erreur), pas du
    // blocage amont — c'est le même code que celui écrit en base (controle_code)
    const controles = (res.data.controles ?? []) as Array<{ code: string; resultat: string }>;
    const premiereErreur = controles.find((c) => c.resultat === "erreur");
    return {
      piece_id: inputData.piece_id,
      statut: res.data.statut as "PRET" | "ANOMALIE",
      controle_code: premiereErreur?.code ?? inputData.code_blocage,
      erreurs_count: res.data.erreurs_count as number,
      warnings_count: res.data.warnings_count as number,
    };
  },
});

// ----- Workflow -----

export const intakeWorkflow = createWorkflow({
  id: "intake",
  description:
    "Intake documentaire : réception → OCR → classification → extraction → rattachement → contrôle",
  inputSchema: workflowInput,
  outputSchema: workflowOutput,
})
  .then(recevoirFichier)
  .then(analyserOcr)
  .then(classifier)
  .then(extraireDonnees)
  .then(rattacher)
  .then(controler)
  .commit();
