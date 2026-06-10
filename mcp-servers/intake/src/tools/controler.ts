import { PieceInput } from "@mistra/shared";
import { getPieceById, saveControle, chercherDoublon, tiersEstConnu, moyenneMontantTtc } from "../db/pieces.repository.js";
import { mcpSuccess, mcpError } from "@mistra/shared";
import { LIMITES, ERREURS, WARNINGS } from "@mistra/shared";
import type { ControleLigne } from "@mistra/shared";

export const controlerTool = {
  name: "intake_controler",
  description: "Exécute toutes les règles de validation et détermine le statut final",
  inputSchema: PieceInput,

  execute: async (input: { cabinet_id: string; piece_id: string }) => {
    const start = Date.now();

    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_controler", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }

    const controles: ControleLigne[] = [];
    let hasErreur = false;

    // 1. OCR minimum
    if (!piece.ocr_confidence || piece.ocr_confidence < LIMITES.OCR_CONFIDENCE_MIN) {
      controles.push({ code: "FICHIER_ILLISIBLE", resultat: "erreur", message: ERREURS.FICHIER_ILLISIBLE });
      hasErreur = true;
    } else if (piece.ocr_confidence < LIMITES.OCR_CONFIDENCE_FAIBLE) {
      controles.push({ code: "RESOLUTION_FAIBLE", resultat: "warning", message: WARNINGS.RESOLUTION_FAIBLE });
    }

    // 2. Date pièce
    if (!piece.date_piece) {
      controles.push({ code: "DATE_ABSENTE", resultat: "erreur", message: ERREURS.DATE_ABSENTE });
      hasErreur = true;
    }

    // 3. Montant présent
    if (piece.type_document !== "RELEVE_BANCAIRE" && !piece.montant_ttc) {
      controles.push({ code: "MONTANT_ABSENT", resultat: "erreur", message: "Aucun montant TTC extrait" });
      hasErreur = true;
    }

    // 4. Cohérence HT + TVA = TTC
    if (piece.montant_ht !== null && piece.montant_tva !== null && piece.montant_ttc !== null) {
      const ecart = Math.abs(piece.montant_ht + piece.montant_tva - piece.montant_ttc);
      if (ecart > LIMITES.MONTANT_TOLERANCE) {
        controles.push({ code: "MONTANT_INCOHERENT", resultat: "erreur", message: `HT(${piece.montant_ht}) + TVA(${piece.montant_tva}) ≠ TTC(${piece.montant_ttc}), écart: ${ecart}` });
        hasErreur = true;
      }
    }

    // 5. Tiers présent (factures)
    if ((piece.type_document === "FACTURE_FOURNISSEUR" || piece.type_document === "FACTURE_CLIENT") && !piece.tiers_nom) {
      controles.push({ code: "TIERS_ABSENT", resultat: "erreur", message: ERREURS.TIERS_ABSENT });
      hasErreur = true;
    }

    // 6. Numéro pièce (factures)
    if ((piece.type_document === "FACTURE_FOURNISSEUR" || piece.type_document === "FACTURE_CLIENT") && !piece.numero_piece) {
      controles.push({ code: "NUMERO_ABSENT", resultat: "erreur", message: ERREURS.NUMERO_ABSENT });
      hasErreur = true;
    }

    // 7. Doublon
    const doublon = await chercherDoublon(input.cabinet_id, input.piece_id);
    if (doublon) {
      controles.push({ code: "DOUBLON", resultat: "erreur", message: `Doublon de ${doublon.id}` });
      hasErreur = true;
    }

    // 8. IBAN (relevé bancaire)
    if (piece.type_document === "RELEVE_BANCAIRE" && !piece.iban) {
      controles.push({ code: "IBAN_ABSENT", resultat: "erreur", message: ERREURS.IBAN_ABSENT });
      hasErreur = true;
    }

    // 9. Soldes (relevé bancaire)
    if (piece.type_document === "RELEVE_BANCAIRE" && (piece.solde_initial === null || piece.solde_final === null)) {
      controles.push({ code: "SOLDES_ABSENTS", resultat: "erreur", message: ERREURS.SOLDES_ABSENTS });
      hasErreur = true;
    }

    // Warnings (non bloquants)
    const warnings = controles.filter(c => c.resultat === "warning");

    // Warning : tiers inconnu
    if (piece.tiers_nom && piece.dossier_id) {
      const estConnu = await tiersEstConnu(input.cabinet_id, piece.dossier_id, piece.tiers_nom);
      if (!estConnu) {
        warnings.push({ code: "TIERS_INCONNU", resultat: "warning", message: WARNINGS.TIERS_INCONNU });
      }
    }

    // Warning : montant inhabituel
    if (piece.montant_ttc && piece.type_document && piece.dossier_id) {
      const moyenne = await moyenneMontantTtc(input.cabinet_id, piece.dossier_id, piece.type_document);
      if (moyenne > 0 && piece.montant_ttc > moyenne * LIMITES.MONTANT_INHABITUEL_X) {
        warnings.push({ code: "MONTANT_INHABITUEL", resultat: "warning", message: `${piece.montant_ttc / 100}€ > 3x moyenne ${moyenne / 100}€` });
      }
    }

    // Warning : taux TVA atypique
    if (piece.taux_tva && piece.taux_tva !== 2000) {
      warnings.push({ code: "TAUX_TVA_ATYPIQUE", resultat: "warning", message: `Taux: ${piece.taux_tva / 100}% (attendu 20%)` });
    }

    // Warning : montant entier
    if (piece.montant_ttc && piece.montant_ttc % 100000 === 0) {
      warnings.push({ code: "MONTANT_ENTIER", resultat: "warning", message: WARNINGS.MONTANT_ENTIER });
    }

    const allControles = [...controles, ...warnings];
    const erreurs = allControles.filter(c => c.resultat === "erreur");
    const allWarnings = allControles.filter(c => c.resultat === "warning");

    const statutFinal: "PRET" | "ANOMALIE" = hasErreur ? "ANOMALIE" : "PRET";
    const codePrincipal = hasErreur ? erreurs[0]?.code ?? "ERREUR" : null;
    const messagePrincipal = hasErreur ? erreurs[0]?.message ?? "Anomalie détectée" : null;

    await saveControle(input.cabinet_id, input.piece_id, statutFinal, codePrincipal, messagePrincipal, allWarnings);

    const result = mcpSuccess("intake_controler", {
      piece_id: input.piece_id,
      statut: statutFinal,
      controles: allControles,
      erreurs_count: erreurs.length,
      warnings_count: allWarnings.length,
    });
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
