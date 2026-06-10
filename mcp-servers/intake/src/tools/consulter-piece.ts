import { PieceInput } from "@mistra/shared";
import { getPieceById } from "../db/pieces.repository.js";
import { mcpSuccess, mcpError } from "@mistra/shared";

export const consulterPieceTool = {
  name: "intake_consulter_piece",
  description: "Lit l'état complet d'une pièce",
  inputSchema: PieceInput,

  execute: async (input: { cabinet_id: string; piece_id: string }) => {
    const start = Date.now();

    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_consulter_piece", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }

    const result = mcpSuccess("intake_consulter_piece", piece);
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
