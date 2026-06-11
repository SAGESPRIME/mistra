import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { appelerToolIntake } from "../tools/intake.tools.js";

// ===== Workflow recontrôle =====
// L'expert-comptable corrige les champs d'une pièce en ANOMALIE, puis le contrôle
// complet est relancé. Le tool intake_controler reste la source unique de vérité
// du statut (décision G.3) — exactement le même contrôle qu'à l'intake initial.

// ----- Schémas -----

const workflowInput = z.object({
  cabinet_id: z.string().uuid(),
  piece_id: z.string().uuid(),
  // Champs corrigeables — la validation stricte (champs autorisés, types) est faite
  // par le tool intake_corriger_piece avec le schéma partagé CorrigerPieceInput
  corrections: z.record(z.string(), z.unknown()),
});

const controleLigne = z.object({
  code: z.string(),
  resultat: z.enum(["ok", "warning", "erreur"]),
  message: z.string(),
});

const workflowOutput = z.object({
  piece_id: z.string(),
  statut: z.enum(["PRET", "ANOMALIE"]),
  controle_code: z.string().nullable(),
  erreurs_count: z.number(),
  warnings_count: z.number(),
  champs_corriges: z.array(z.string()),
  controles: z.array(controleLigne),
});

// ----- Steps -----

// Step 1 : appliquer les corrections (la pièce repasse en TRAITEMENT)
const corriger = createStep({
  id: "corriger",
  description: "Applique les corrections manuelles sur la pièce en anomalie",
  inputSchema: workflowInput,
  outputSchema: z.object({
    cabinet_id: z.string().uuid(),
    piece_id: z.string().uuid(),
    champs_corriges: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const res = await appelerToolIntake("corriger_piece", inputData);
    if (!res.success) {
      // Pièce introuvable, pas en ANOMALIE, corrections vides... → échec clair du run
      throw new Error(
        `Correction impossible: ${res.error?.code ?? "ERREUR"} — ${res.error?.message ?? ""}`,
      );
    }
    return {
      cabinet_id: inputData.cabinet_id,
      piece_id: inputData.piece_id,
      champs_corriges: (res.data?.champs_corriges as string[]) ?? [],
    };
  },
});

// Step 2 : recontrôler — même tool que le contrôle final de l'intake
const recontroler = createStep({
  id: "recontroler",
  description: "Relance le contrôle complet et fixe le statut final (PRET/ANOMALIE)",
  inputSchema: z.object({
    cabinet_id: z.string().uuid(),
    piece_id: z.string().uuid(),
    champs_corriges: z.array(z.string()),
  }),
  outputSchema: workflowOutput,
  execute: async ({ inputData }) => {
    const res = await appelerToolIntake("controler", {
      cabinet_id: inputData.cabinet_id,
      piece_id: inputData.piece_id,
    });
    if (!res.success || !res.data) {
      throw new Error(
        `Recontrôle impossible: ${res.error?.code ?? "ERREUR"} — ${res.error?.message ?? ""}`,
      );
    }
    const controles = (res.data.controles ?? []) as z.infer<typeof controleLigne>[];
    const premiereErreur = controles.find((c) => c.resultat === "erreur");
    return {
      piece_id: inputData.piece_id,
      statut: res.data.statut as "PRET" | "ANOMALIE",
      controle_code: premiereErreur?.code ?? null,
      erreurs_count: res.data.erreurs_count as number,
      warnings_count: res.data.warnings_count as number,
      champs_corriges: inputData.champs_corriges,
      controles,
    };
  },
});

// ----- Workflow -----

export const recontroleWorkflow = createWorkflow({
  id: "recontrole",
  description: "Correction manuelle d'une pièce en anomalie puis recontrôle complet",
  inputSchema: workflowInput,
  outputSchema: workflowOutput,
})
  .then(corriger)
  .then(recontroler)
  .commit();
