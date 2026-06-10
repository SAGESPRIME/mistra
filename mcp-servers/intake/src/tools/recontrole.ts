import { PieceInput } from "@mistra/shared";
import { getPieceById } from "../db/pieces.repository.js";
import { mcpSuccess, mcpError } from "@mistra/shared";
import { controlerTool } from "./controler.js";

export const recontroleTool = {
  name: "intake_recontrole",
  description: "Rejoue les contrôles après correction humaine",
  inputSchema: PieceInput,

  execute: async (input: { cabinet_id: string; piece_id: string }) => {
    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_recontrole", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }
    if (piece.statut !== "TRAITEMENT") {
      return mcpError("intake_recontrole", "STATUT_INCORRECT", `Statut: ${piece.statut}, attendu: TRAITEMENT`);
    }

    // Rejoue le contrôle complet
    return controlerTool.execute(input);
  },
};
