import { RechercherPiecesInput } from "@mistra/shared";
import { rechercherPieces } from "../db/pieces.repository.js";
import { mcpSuccess, mcpError } from "@mistra/shared";

export const rechercherPiecesTool = {
  name: "intake_rechercher_pieces",
  description: "Liste les pièces avec filtres et pagination",
  inputSchema: RechercherPiecesInput,

  execute: async (input: z.infer<typeof RechercherPiecesInput>) => {
    const start = Date.now();

    const { pieces, total } = await rechercherPieces({
      cabinet_id: input.cabinet_id,
      client_id: input.client_id,
      dossier_id: input.dossier_id,
      periode_id: input.periode_id,
      statut: input.statut,
      type_document: input.type_document,
      page: input.page ?? 1,
      limite: input.limite ?? 20,
    });

    const result = mcpSuccess("intake_rechercher_pieces", {
      pieces,
      total,
      page: input.page ?? 1,
      limite: input.limite ?? 20,
    });
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
