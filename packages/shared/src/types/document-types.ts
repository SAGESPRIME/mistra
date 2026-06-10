// Types de documents supportés en V1
export type DocumentType =
  | "FACTURE_FOURNISSEUR"
  | "FACTURE_CLIENT"
  | "NOTE_DE_FRAIS"
  | "RELEVE_BANCAIRE";

// Statuts du cycle de vie d'une pièce
export type PieceStatut =
  | "RECU"
  | "TRAITEMENT"
  | "PRET"
  | "ANOMALIE";

// Source de réception du document
export type SourceReception = "upload";

// Extensions de fichiers acceptées
export type FichierType = "pdf" | "jpeg" | "png" | "webp";

// Labels pour l'affichage
export const STATUT_LABELS: Record<PieceStatut, string> = {
  RECU: "Reçu",
  TRAITEMENT: "En traitement",
  PRET: "Prêt",
  ANOMALIE: "Anomalie",
};

export const STATUT_COLORS: Record<PieceStatut, string> = {
  RECU: "gray",
  TRAITEMENT: "blue",
  PRET: "green",
  ANOMALIE: "red",
};

export const TYPE_LABELS: Record<DocumentType, string> = {
  FACTURE_FOURNISSEUR: "Facture fournisseur",
  FACTURE_CLIENT: "Facture client",
  NOTE_DE_FRAIS: "Note de frais",
  RELEVE_BANCAIRE: "Relevé bancaire",
};

export const DOCUMENT_TYPES: DocumentType[] = [
  "FACTURE_FOURNISSEUR",
  "FACTURE_CLIENT",
  "NOTE_DE_FRAIS",
  "RELEVE_BANCAIRE",
];

export const PIECE_STATUTS: PieceStatut[] = [
  "RECU",
  "TRAITEMENT",
  "PRET",
  "ANOMALIE",
];

export const FICHIER_TYPES: FichierType[] = ["pdf", "jpeg", "png", "webp"];
