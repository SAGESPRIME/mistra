import { z } from "zod";
import { RecevoirFichierInput } from "@mistra/shared";
import { createPiece, getPieceById } from "../db/pieces.repository.js";
import { verifierFichierAccessible, getTailleFichier } from "../services/stockage.service.js";
import { mcpSuccess, mcpError } from "@mistra/shared";
import { LIMITES } from "@mistra/shared";

export const recevoirFichierTool = {
  name: "intake_recevoir_fichier",
  description: "Crée une pièce en statut RECU à partir d'un fichier uploadé",
  inputSchema: RecevoirFichierInput,

  execute: async (input: z.infer<typeof RecevoirFichierInput>) => {
    const start = Date.now();

    // Vérifier fichier accessible
    const accessible = await verifierFichierAccessible(input.fichier_url);
    if (!accessible) {
      return mcpError("intake_recevoir_fichier", "FICHIER_INACCESSIBLE", "URL non joignable ou timeout");
    }

    // Vérifier taille
    const taille = await getTailleFichier(input.fichier_url);
    if (taille > LIMITES.FICHIER_TAILLE_MAX) {
      return mcpError("intake_recevoir_fichier", "FICHIER_TROP_VOLUMINEUX", `Taille ${taille} octets > limite ${LIMITES.FICHIER_TAILLE_MAX}`);
    }

    // Créer la pièce
    const piece = await createPiece({
      cabinet_id: input.cabinet_id,
      client_id: input.client_id,
      fichier_url: input.fichier_url,
      fichier_nom: input.fichier_nom,
      fichier_type: input.fichier_type,
      source: input.source,
    });

    const result = mcpSuccess("intake_recevoir_fichier", {
      piece_id: piece.id,
      statut: piece.statut,
      created_at: piece.created_at,
    });
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
