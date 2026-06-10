// Codes d'erreur (bloquants → ANOMALIE)
export const ERREURS = {
  FICHIER_ILLISIBLE: "Fichier illisible ou OCR trop faible",
  FICHIER_CORROMPU: "Le fichier ne peut pas être ouvert",
  DOUBLON: "Une pièce identique existe déjà dans ce dossier",
  MONTANT_INCOHERENT: "HT + TVA ≠ TTC (écart > 1€)",
  DATE_ABSENTE: "Aucune date détectée sur le document",
  DATE_HORS_EXERCICE: "Date en dehors de l'exercice comptable",
  TIERS_ABSENT: "Aucun tiers identifié sur une facture",
  NUMERO_ABSENT: "Aucun numéro de pièce détecté sur une facture",
  TYPE_INCONNU: "Impossible de classifier le document",
  IBAN_ABSENT: "Aucun IBAN détecté sur un relevé bancaire",
  SOLDES_ABSENTS: "Soldes initial/final manquants sur un relevé bancaire",
} as const;

// Codes de warning (non bloquants, pièce reste PRET)
export const WARNINGS = {
  TIERS_INCONNU: "Tiers jamais vu dans ce dossier",
  MONTANT_INHABITUEL: "Montant > 3x la moyenne du même type",
  TAUX_TVA_ATYPIQUE: "Taux TVA différent de 20%",
  RESOLUTION_FAIBLE: "Qualité OCR faible (0.5-0.7)",
  ECHEANCE_LONGUE: "Échéance > 90 jours après la date de pièce",
  PERIODE_ANTECHEURE: "Date dans une période déjà clôturée",
  MONTANT_ENTIER: "Montant TTC rond (souvent un acompte)",
  CLASSIFICATION_FAIBLE: "Confiance classification faible (0.6-0.8)",
  CHAMPS_PARTIELS: "Moins de 50% des champs attendus extraits",
} as const;

export type ErreurCode = keyof typeof ERREURS;
export type WarningCode = keyof typeof WARNINGS;
