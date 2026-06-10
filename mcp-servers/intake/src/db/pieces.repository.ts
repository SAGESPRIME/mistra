import { query } from "./connection.js";
import type { Piece, ControleLigne } from "@mistra/shared";
import type { PieceStatut, DocumentType } from "@mistra/shared";

// Créer une pièce en statut RECU
export async function createPiece(input: {
  cabinet_id: string;
  client_id: string;
  fichier_url: string;
  fichier_nom: string;
  fichier_type: string;
  source: string;
}): Promise<Piece> {
  const result = await query(
    `INSERT INTO pieces (cabinet_id, client_id, fichier_url, fichier_nom, fichier_type, source, statut, warnings)
     VALUES ($1, $2, $3, $4, $5, $6, 'RECU', '[]'::jsonb)
     RETURNING *`,
    [input.cabinet_id, input.client_id, input.fichier_url, input.fichier_nom, input.fichier_type, input.source],
  );
  return rowToPiece(result.rows[0]);
}

// Récupérer une pièce par ID (avec vérification cabinet)
export async function getPieceById(cabinetId: string, pieceId: string): Promise<Piece | null> {
  const result = await query(
    "SELECT * FROM pieces WHERE id = $1 AND cabinet_id = $2",
    [pieceId, cabinetId],
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Mettre à jour le statut d'une pièce
export async function updateStatut(
  cabinetId: string,
  pieceId: string,
  statut: PieceStatut,
  controleCode?: string,
  controleMessage?: string,
): Promise<Piece | null> {
  const result = await query(
    `UPDATE pieces SET statut = $3, controle_code = $4, controle_message = $5, updated_at = now()
     WHERE id = $1 AND cabinet_id = $2
     RETURNING *`,
    [pieceId, cabinetId, statut, controleCode ?? null, controleMessage ?? null],
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Mettre à jour les données OCR
export async function updateOcr(
  cabinetId: string,
  pieceId: string,
  ocrTexte: string,
  ocrConfidence: number,
  ocrPages: number,
): Promise<Piece | null> {
  const result = await query(
    `UPDATE pieces SET ocr_texte = $3, ocr_confidence = $4, ocr_pages = $5, statut = 'TRAITEMENT', updated_at = now()
     WHERE id = $1 AND cabinet_id = $2
     RETURNING *`,
    [pieceId, cabinetId, ocrTexte, ocrConfidence, ocrPages],
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Mettre à jour la classification
export async function updateClassification(
  cabinetId: string,
  pieceId: string,
  typeDocument: DocumentType,
): Promise<Piece | null> {
  const result = await query(
    `UPDATE pieces SET type_document = $3, updated_at = now()
     WHERE id = $1 AND cabinet_id = $2
     RETURNING *`,
    [pieceId, cabinetId, typeDocument],
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Mettre à jour les données extraites
export async function updateDonneesExtraites(
  cabinetId: string,
  pieceId: string,
  data: Record<string, unknown>,
): Promise<Piece | null> {
  const fields: string[] = [];
  const values: unknown[] = [pieceId, cabinetId];
  let paramIdx = 3;

  const allowedFields = [
    "date_piece", "date_echeance", "tiers_nom", "tiers_siret",
    "numero_piece", "description", "montant_ht", "montant_tva",
    "montant_ttc", "taux_tva", "iban", "solde_initial", "solde_final",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined && data[field] !== null) {
      fields.push(`${field} = $${paramIdx}`);
      values.push(data[field]);
      paramIdx++;
    }
  }

  if (fields.length === 0) return getPieceById(cabinetId, pieceId);

  fields.push("updated_at = now()");
  values.push(pieceId, cabinetId);

  const result = await query(
    `UPDATE pieces SET ${fields.join(", ")}
     WHERE id = $${paramIdx} AND cabinet_id = $${paramIdx + 1}
     RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Rattacher une pièce à un dossier et une période
export async function rattacher(
  cabinetId: string,
  pieceId: string,
  dossierId: string,
  periodeId: string,
): Promise<Piece | null> {
  const result = await query(
    `UPDATE pieces SET dossier_id = $3, periode_id = $4, updated_at = now()
     WHERE id = $1 AND cabinet_id = $2
     RETURNING *`,
    [pieceId, cabinetId, dossierId, periodeId],
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Chercher un doublon potentiel
export async function chercherDoublon(
  cabinetId: string,
  pieceId: string,
): Promise<Piece | null> {
  const piece = await getPieceById(cabinetId, pieceId);
  if (!piece || !piece.tiers_nom || !piece.numero_piece || !piece.montant_ttc || !piece.date_piece || !piece.dossier_id) {
    return null;
  }

  const result = await query(
    `SELECT * FROM pieces
     WHERE cabinet_id = $1 AND dossier_id = $2
       AND tiers_nom = $3 AND numero_piece = $4
       AND montant_ttc = $5 AND date_piece = $6
       AND id != $7
     LIMIT 1`,
    [cabinetId, piece.dossier_id, piece.tiers_nom, piece.numero_piece, piece.montant_ttc, piece.date_piece, pieceId],
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Sauvegarder le résultat du contrôle
export async function saveControle(
  cabinetId: string,
  pieceId: string,
  statut: PieceStatut,
  controleCode: string | null,
  controleMessage: string | null,
  warnings: ControleLigne[],
): Promise<Piece | null> {
  const result = await query(
    `UPDATE pieces SET statut = $3, controle_code = $4, controle_message = $5, warnings = $6, updated_at = now()
     WHERE id = $1 AND cabinet_id = $2
     RETURNING *`,
    [pieceId, cabinetId, statut, controleCode, controleMessage, JSON.stringify(warnings)],
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Corriger une pièce en anomalie
export async function corriger(
  cabinetId: string,
  pieceId: string,
  corrections: Record<string, unknown>,
): Promise<Piece | null> {
  const fields: string[] = ["statut = 'TRAITEMENT'"];
  const values: unknown[] = [];
  let paramIdx = 1;

  const allowedFields = [
    "type_document", "date_piece", "tiers_nom", "tiers_siret",
    "numero_piece", "montant_ht", "montant_tva", "montant_ttc",
    "taux_tva", "iban", "dossier_id", "periode_id",
  ];

  for (const field of allowedFields) {
    if (corrections[field] !== undefined) {
      fields.push(`${field} = $${paramIdx}`);
      values.push(corrections[field]);
      paramIdx++;
    }
  }

  fields.push("updated_at = now()");
  values.push(pieceId, cabinetId);

  const result = await query(
    `UPDATE pieces SET ${fields.join(", ")}
     WHERE id = $${paramIdx} AND cabinet_id = $${paramIdx + 1} AND statut = 'ANOMALIE'
     RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Rechercher des pièces avec filtres
export async function rechercherPieces(filters: {
  cabinet_id: string;
  client_id?: string;
  dossier_id?: string;
  periode_id?: string;
  statut?: string;
  type_document?: string;
  page: number;
  limite: number;
}): Promise<{ pieces: Piece[]; total: number }> {
  const conditions: string[] = ["cabinet_id = $1"];
  const values: unknown[] = [filters.cabinet_id];
  let paramIdx = 2;

  if (filters.client_id) {
    conditions.push(`client_id = $${paramIdx}`);
    values.push(filters.client_id);
    paramIdx++;
  }
  if (filters.dossier_id) {
    conditions.push(`dossier_id = $${paramIdx}`);
    values.push(filters.dossier_id);
    paramIdx++;
  }
  if (filters.periode_id) {
    conditions.push(`periode_id = $${paramIdx}`);
    values.push(filters.periode_id);
    paramIdx++;
  }
  if (filters.statut) {
    conditions.push(`statut = $${paramIdx}`);
    values.push(filters.statut);
    paramIdx++;
  }
  if (filters.type_document) {
    conditions.push(`type_document = $${paramIdx}`);
    values.push(filters.type_document);
    paramIdx++;
  }

  const where = conditions.join(" AND ");

  // Count
  const countResult = await query(`SELECT COUNT(*) as total FROM pieces WHERE ${where}`, values);
  const total = parseInt(countResult.rows[0].total, 10);

  // Data
  const offset = (filters.page - 1) * filters.limite;
  values.push(filters.limite, offset);
  const dataResult = await query(
    `SELECT * FROM pieces WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    values,
  );

  return {
    pieces: dataResult.rows.map(rowToPiece),
    total,
  };
}

// Vérifier si un tiers a déjà été vu dans un dossier
export async function tiersEstConnu(cabinetId: string, dossierId: string, tiersNom: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM pieces
     WHERE cabinet_id = $1 AND dossier_id = $2 AND tiers_nom = $3
     LIMIT 1`,
    [cabinetId, dossierId, tiersNom],
  );
  return result.rowCount !== null && result.rowCount > 0;
}

// Calculer la moyenne des montants TTC pour un type dans un dossier
export async function moyenneMontantTtc(
  cabinetId: string,
  dossierId: string,
  typeDocument: string,
): Promise<number> {
  const result = await query(
    `SELECT AVG(montant_ttc) as moyenne FROM pieces
     WHERE cabinet_id = $1 AND dossier_id = $2 AND type_document = $3 AND montant_ttc IS NOT NULL`,
    [cabinetId, dossierId, typeDocument],
  );
  return parseFloat(result.rows[0]?.moyenne ?? "0");
}

// Transformer une ligne DB en objet Piece
function rowToPiece(row: Record<string, unknown>): Piece {
  return {
    id: row.id as string,
    cabinet_id: row.cabinet_id as string,
    client_id: row.client_id as string,
    dossier_id: row.dossier_id as string | null,
    periode_id: row.periode_id as string | null,
    fichier_url: row.fichier_url as string,
    fichier_nom: row.fichier_nom as string,
    fichier_type: row.fichier_type as "pdf" | "jpeg" | "png" | "webp",
    source: row.source as "upload",
    type_document: row.type_document as DocumentType | null,
    ocr_texte: row.ocr_texte as string | null,
    ocr_confidence: row.ocr_confidence as number | null,
    ocr_pages: row.ocr_pages as number | null,
    date_piece: row.date_piece as string | null,
    date_echeance: row.date_echeance as string | null,
    tiers_nom: row.tiers_nom as string | null,
    tiers_siret: row.tiers_siret as string | null,
    numero_piece: row.numero_piece as string | null,
    description: row.description as string | null,
    montant_ht: row.montant_ht as number | null,
    montant_tva: row.montant_tva as number | null,
    montant_ttc: row.montant_ttc as number | null,
    taux_tva: row.taux_tva as number | null,
    iban: row.iban as string | null,
    solde_initial: row.solde_initial as number | null,
    solde_final: row.solde_final as number | null,
    statut: row.statut as PieceStatut,
    controle_code: row.controle_code as string | null,
    controle_message: row.controle_message as string | null,
    warnings: typeof row.warnings === "string" ? JSON.parse(row.warnings) : (row.warnings as ControleLigne[] ?? []),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
