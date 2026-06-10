import { PieceInput } from "@mistra/shared";
import { getPieceById, chercherDoublon } from "../db/pieces.repository.js";
import { mcpSuccess, mcpError } from "@mistra/shared";

export const detecterDoublonTool = {
  name: "intake_detecter_doublon",
  description: "Vérifie si une pièce identique existe déjà dans le dossier",
  inputSchema: PieceInput,

  execute: async (input: { cabinet_id: string; piece_id: string }) => {
    const start = Date.now();

    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_detecter_doublon", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }

    const doublon = await chercherDoublon(input.cabinet_id, input.piece_id);

    const result = mcpSuccess("intake_detecter_doublon", {
      piece_id: input.piece_id,
      doublon_detecte: doublon !== null,
      doublon_de: doublon?.id ?? null,
      doublon_score: doublon ? 1.0 : 0.0,
    });
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
