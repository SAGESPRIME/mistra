import { CorrigerPieceInput } from "@mistra/shared";
import { getPieceById, corriger } from "../db/pieces.repository.js";
import { mcpSuccess, mcpError } from "@mistra/shared";

export const corrigerPieceTool = {
  name: "intake_corriger_piece",
  description: "Corrige manuellement les champs d'une pièce en anomalie",
  inputSchema: CorrigerPieceInput,

  execute: async (input: z.infer<typeof CorrigerPieceInput>) => {
    const start = Date.now();

    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_corriger_piece", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }
    if (piece.statut !== "ANOMALIE") {
      return mcpError("intake_corriger_piece", "STATUT_INCORRECT", `Statut: ${piece.statut}, attendu: ANOMALIE`);
    }

    const corrections = input.corrections as Record<string, unknown>;
    if (Object.keys(corrections).length === 0) {
      return mcpError("intake_corriger_piece", "AUCUNE_CORRECTION", "Objet corrections vide");
    }

    const champsCorriges = Object.keys(corrections);
    const updated = await corriger(input.cabinet_id, input.piece_id, corrections);

    if (!updated) {
      return mcpError("intake_corriger_piece", "CORRECTION_ECHOUEE", "Impossible de mettre à jour la pièce");
    }

    const result = mcpSuccess("intake_corriger_piece", {
      piece_id: input.piece_id,
      champs_corriges: champsCorriges,
      statut: "TRAITEMENT",
    });
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
