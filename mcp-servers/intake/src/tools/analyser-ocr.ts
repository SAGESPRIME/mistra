import { PieceInput } from "@mistra/shared";
import { getPieceById, updateOcr } from "../db/pieces.repository.js";
import { analyserFichier } from "../services/ocr.service.js";
import { mcpSuccess, mcpError } from "@mistra/shared";
import { LIMITES } from "@mistra/shared";

export const analyserOcrTool = {
  name: "intake_analyser_ocr",
  description: "Extrait le texte et le score de confiance d'une pièce via OCR",
  inputSchema: PieceInput,

  execute: async (input: { cabinet_id: string; piece_id: string }) => {
    const start = Date.now();

    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_analyser_ocr", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }
    if (piece.statut !== "RECU" && piece.statut !== "TRAITEMENT") {
      return mcpError("intake_analyser_ocr", "STATUT_INCORRECT", `Statut actuel: ${piece.statut}, attendu: RECU ou TRAITEMENT`);
    }

    try {
      const ocrResult = await analyserFichier(piece.fichier_url);

      if (ocrResult.confidence < LIMITES.OCR_CONFIDENCE_MIN) {
        // Mettre en anomalie
        await updateOcr(input.cabinet_id, input.piece_id, ocrResult.texte, ocrResult.confidence, ocrResult.pages);
        return mcpError("intake_analyser_ocr", "FICHIER_ILLISIBLE", `OCR confidence: ${ocrResult.confidence.toFixed(2)} < ${LIMITES.OCR_CONFIDENCE_MIN}`);
      }

      const updated = await updateOcr(input.cabinet_id, input.piece_id, ocrResult.texte, ocrResult.confidence, ocrResult.pages);

      const warnings = [];
      if (ocrResult.confidence < LIMITES.OCR_CONFIDENCE_FAIBLE) {
        warnings.push({ code: "RESOLUTION_FAIBLE", message: `Confiance OCR: ${ocrResult.confidence.toFixed(2)}` });
      }

      const result = mcpSuccess("intake_analyser_ocr", {
        piece_id: input.piece_id,
        ocr_texte: ocrResult.texte.substring(0, 500),
        ocr_confidence: ocrResult.confidence,
        ocr_pages: ocrResult.pages,
        statut: updated?.statut ?? "TRAITEMENT",
      }, warnings);
      result.metadata!.duration_ms = Date.now() - start;
      return result;
    } catch (error) {
      return mcpError("intake_analyser_ocr", "FICHIER_CORROMPU", error instanceof Error ? error.message : "Erreur OCR");
    }
  },
};
