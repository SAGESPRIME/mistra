import { PieceInput } from "@mistra/shared";
import { getPieceById, updateDonneesExtraites } from "../db/pieces.repository.js";
import { extraire } from "../services/llm.service.js";
import { mcpSuccess, mcpError } from "@mistra/shared";

export const extraireDonneesTool = {
  name: "intake_extraire_donnees",
  description: "Extrait les données structurées à partir du texte OCR et du type classifié",
  inputSchema: PieceInput,

  execute: async (input: { cabinet_id: string; piece_id: string }) => {
    const start = Date.now();

    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_extraire_donnees", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }
    if (piece.statut !== "TRAITEMENT") {
      return mcpError("intake_extraire_donnees", "STATUT_INCORRECT", `Statut actuel: ${piece.statut}`);
    }
    if (!piece.ocr_texte) {
      return mcpError("intake_extraire_donnees", "OCR_MANQUANT", "Pas de texte OCR");
    }
    if (!piece.type_document) {
      return mcpError("intake_extraire_donnees", "TYPE_MANQUANT", "Pas encore classifiée");
    }

    const extraction = await extraire(piece.ocr_texte, piece.type_document);
    const data = extraction.data as Record<string, unknown>;

    const updated = await updateDonneesExtraites(input.cabinet_id, input.piece_id, data);

    // Compter les champs extraits vs attendus
    const expectedFields = ["date_piece", "tiers_nom", "numero_piece", "montant_ttc"];
    if (piece.type_document === "RELEVE_BANCAIRE") {
      expectedFields.push("iban", "solde_initial", "solde_final");
    }
    const extractedCount = expectedFields.filter(f => data[f] !== null && data[f] !== undefined).length;
    const ratio = extractedCount / expectedFields.length;

    const warnings = [];
    if (ratio < 0.5) {
      warnings.push({ code: "CHAMPS_PARTIELS", message: `${extractedCount}/${expectedFields.length} champs extraits` });
    }

    const result = mcpSuccess("intake_extraire_donnees", {
      piece_id: input.piece_id,
      date_piece: data.date_piece ?? null,
      date_echeance: data.date_echeance ?? null,
      tiers_nom: data.tiers_nom ?? null,
      tiers_siret: data.tiers_siret ?? null,
      numero_piece: data.numero_piece ?? null,
      description: data.description ?? null,
      montant_ht: data.montant_ht ?? null,
      montant_tva: data.montant_tva ?? null,
      montant_ttc: data.montant_ttc ?? null,
      taux_tva: data.taux_tva ?? null,
      iban: data.iban ?? null,
      solde_initial: data.solde_initial ?? null,
      solde_final: data.solde_final ?? null,
    }, warnings);
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
