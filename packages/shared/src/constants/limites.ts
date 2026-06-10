// Seuils et limites pour l'Agent 1

export const LIMITES = {
  // OCR
  OCR_CONFIDENCE_MIN: 0.5,         // En dessous = FICHIER_ILLISIBLE
  OCR_CONFIDENCE_FAIBLE: 0.7,      // Entre 0.5 et 0.7 = warning RESOLUTION_FAIBLE

  // Classification
  CLASSIFICATION_MIN: 0.6,          // En dessous = TYPE_INCONNU
  CLASSIFICATION_FAIBLE: 0.8,       // Entre 0.6 et 0.8 = warning

  // Doublon
  DOUBLON_SCORE_MIN: 0.9,           // Score de similarité minimum

  // Montants
  MONTANT_TOLERANCE: 100,           // Tolérance HT+TVA vs TTC en centimes (1€)
  MONTANT_INHABITUEL_X: 3,          // Multipliant pour montant inhabituel

  // Dates
  ECHEANCE_MAX_JOURS: 90,           // Jours max entre date pièce et échéance
  EXERCICE_TOLERANCE_MOIS: 15,      // Tolérance en mois hors exercice

  // Fichiers
  FICHIER_TAILLE_MAX: 20 * 1024 * 1024, // 20 Mo

  // Pagination
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,
} as const;
