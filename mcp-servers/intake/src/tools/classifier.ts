import { PieceInput } from "@mistra/shared";
import { getPieceById, updateClassification } from "../db/pieces.repository.js";
import { classifier as classifierLlm } from "../services/llm.service.js";
import { mcpSuccess, mcpError } from "@mistra/shared";
import { LIMITES } from "@mistra/shared";

export const classifierTool = {
  name: "intake_classifier",
  description: "Détermine le type de document parmi les 4 types V1",
  inputSchema: PieceInput,

  execute: async (input: { cabinet_id: string; piece_id: string }) => {
    const start = Date.now();

    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_classifier", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }
    if (piece.statut !== "TRAITEMENT") {
      return mcpError("intake_classifier", "STATUT_INCORRECT", `Statut actuel: ${piece.statut}`);
    }
    if (!piece.ocr_texte) {
      return mcpError("intake_classifier", "OCR_MANQUANT", "Pas de texte OCR disponible");
    }

    const classification = await classifierLlm(piece.ocr_texte);

    if (!classification.data || classification.confidence < LIMITES.CLASSIFICATION_MIN) {
      return mcpError("intake_classifier", "TYPE_INCONNU", `Confiance: ${classification.confidence.toFixed(2)} < ${LIMITES.CLASSIFICATION_MIN}`);
    }

    const updated = await updateClassification(input.cabinet_id, input.piece_id, classification.data as "FACTURE_FOURNISSEUR" | "FACTURE_CLIENT" | "NOTE_DE_FRAIS" | "RELEVE_BANCAIRE");

    const warnings = [];
    if (classification.confidence < LIMITES.CLASSIFICATION_FAIBLE) {
      warnings.push({ code: "CLASSIFICATION_FAIBLE", message: `Confiance: ${classification.confidence.toFixed(2)}` });
    }

    const result = mcpSuccess("intake_classifier", {
      piece_id: input.piece_id,
      type_document: classification.data,
      classification_confidence: classification.confidence,
    }, warnings);
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
