import type { DocumentType, PieceStatut, SourceReception, FichierType } from "./document-types.js";

export interface ControleLigne {
  code: string;
  resultat: "ok" | "warning" | "erreur";
  message: string;
}

export interface Piece {
  id: string;
  cabinet_id: string;
  client_id: string;
  dossier_id: string | null;
  periode_id: string | null;

  // Fichier
  fichier_url: string;
  fichier_nom: string;
  fichier_type: FichierType;
  source: SourceReception;

  // Classification
  type_document: DocumentType | null;

  // OCR
  ocr_texte: string | null;
  ocr_confidence: number | null;
  ocr_pages: number | null;

  // Données extraites
  date_piece: string | null;       // ISO date YYYY-MM-DD
  date_echeance: string | null;
  tiers_nom: string | null;
  tiers_siret: string | null;
  numero_piece: string | null;
  description: string | null;
  montant_ht: number | null;       // centimes
  montant_tva: number | null;      // centimes
  montant_ttc: number | null;      // centimes
  taux_tva: number | null;         // basis points (2000 = 20%)
  iban: string | null;
  solde_initial: number | null;    // centimes
  solde_final: number | null;      // centimes

  // Contrôle
  statut: PieceStatut;
  controle_code: string | null;
  controle_message: string | null;
  warnings: ControleLigne[];

  // Cycle de vie
  created_at: string;
  updated_at: string;
}
