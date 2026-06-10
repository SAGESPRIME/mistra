import { z } from "zod";
import { DOCUMENT_TYPES, PIECE_STATUTS, FICHIER_TYPES } from "../types/document-types.js";

// Input : recevoir un fichier
export const RecevoirFichierInput = z.object({
  cabinet_id: z.string().uuid(),
  client_id: z.string().uuid(),
  fichier_url: z.string().url(),
  fichier_nom: z.string().min(1).max(255),
  fichier_type: z.enum(FICHIER_TYPES as unknown as [string, ...string[]]),
  source: z.literal("upload"),
});

// Input : opérer sur une pièce (OCR, classifier, etc.)
export const PieceInput = z.object({
  cabinet_id: z.string().uuid(),
  piece_id: z.string().uuid(),
});

// Input : rattacher une pièce
export const RattacherInput = z.object({
  cabinet_id: z.string().uuid(),
  piece_id: z.string().uuid(),
  dossier_id: z.string().uuid().optional(),
  periode_id: z.string().uuid().optional(),
});

// Input : corriger une pièce en anomalie
export const CorrigerPieceInput = z.object({
  cabinet_id: z.string().uuid(),
  piece_id: z.string().uuid(),
  corrections: z.object({
    type_document: z.enum(DOCUMENT_TYPES as unknown as [string, ...string[]]).optional(),
    date_piece: z.string().optional(),
    tiers_nom: z.string().optional(),
    tiers_siret: z.string().optional(),
    numero_piece: z.string().optional(),
    montant_ht: z.number().int().optional(),
    montant_tva: z.number().int().optional(),
    montant_ttc: z.number().int().optional(),
    taux_tva: z.number().int().optional(),
    iban: z.string().optional(),
    dossier_id: z.string().uuid().optional(),
    periode_id: z.string().uuid().optional(),
  }),
});

// Input : rechercher des pièces
export const RechercherPiecesInput = z.object({
  cabinet_id: z.string().uuid(),
  client_id: z.string().uuid().optional(),
  dossier_id: z.string().uuid().optional(),
  periode_id: z.string().uuid().optional(),
  statut: z.enum(PIECE_STATUTS as unknown as [string, ...string[]]).optional(),
  type_document: z.enum(DOCUMENT_TYPES as unknown as [string, ...string[]]).optional(),
  page: z.number().int().min(1).default(1),
  limite: z.number().int().min(1).max(100).default(20),
});

// Output : résultat contrôle
export const ControleResult = z.object({
  piece_id: z.string().uuid(),
  statut: z.enum(["PRET", "ANOMALIE"]),
  controles: z.array(z.object({
    code: z.string(),
    resultat: z.enum(["ok", "warning", "erreur"]),
    message: z.string(),
  })),
  erreurs_count: z.number(),
  warnings_count: z.number(),
});
