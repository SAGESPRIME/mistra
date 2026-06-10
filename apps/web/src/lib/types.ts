import type { Piece, ControleLigne, PieceStatut, DocumentType, FichierType } from "@mistra/shared";

export type { Piece, ControleLigne };
export type { PieceStatut, DocumentType, FichierType };

export const STATUT_LABELS: Record<PieceStatut, string> = {
  RECU: "Reçu",
  TRAITEMENT: "En traitement",
  PRET: "Prêt",
  ANOMALIE: "Anomalie",
};

export const STATUT_COLORS: Record<PieceStatut, string> = {
  RECU: "#9ca3af",
  TRAITEMENT: "#3b82f6",
  PRET: "#22c55e",
  ANOMALIE: "#ef4444",
};

export const TYPE_LABELS: Record<DocumentType, string> = {
  FACTURE_FOURNISSEUR: "Facture fournisseur",
  FACTURE_CLIENT: "Facture client",
  NOTE_DE_FRAIS: "Note de frais",
  RELEVE_BANCAIRE: "Relevé bancaire",
};

export function formatMontant(centimes: number | null): string {
  if (centimes === null) return "—";
  return (centimes / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR");
}
