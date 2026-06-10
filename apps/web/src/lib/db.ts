// Module DB pour les routes API Next.js
// Connexion PostgreSQL + requêtes pièces

import pg from "pg";
import type { Piece, ControleLigne, PieceStatut, DocumentType } from "@mistra/shared";

const { Pool } = pg;

// Singleton pour éviter les connexions multiples en dev
let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export async function query(text: string, params?: unknown[]) {
  return getPool().query(text, params);
}

// ===== CRUD Pièces =====

// Créer une pièce
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

// Récupérer une pièce
export async function getPiece(cabinetId: string, pieceId: string): Promise<Piece | null> {
  const result = await query(
    "SELECT * FROM pieces WHERE id = $1 AND cabinet_id = $2",
    [pieceId, cabinetId],
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Rechercher des pièces
export async function searchPieces(filters: {
  cabinet_id: string;
  client_id?: string;
  statut?: string;
  type_document?: string;
  page: number;
  limite: number;
}): Promise<{ pieces: Piece[]; total: number }> {
  const conditions: string[] = ["cabinet_id = $1"];
  const values: unknown[] = [filters.cabinet_id];
  let idx = 2;

  if (filters.client_id) { conditions.push(`client_id = $${idx}`); values.push(filters.client_id); idx++; }
  if (filters.statut) { conditions.push(`statut = $${idx}`); values.push(filters.statut); idx++; }
  if (filters.type_document) { conditions.push(`type_document = $${idx}`); values.push(filters.type_document); idx++; }

  const where = conditions.join(" AND ");

  const countResult = await query(`SELECT COUNT(*) as total FROM pieces WHERE ${where}`, values);
  const total = parseInt(countResult.rows[0].total, 10);

  const offset = (filters.page - 1) * filters.limite;
  values.push(filters.limite, offset);
  const dataResult = await query(
    `SELECT * FROM pieces WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    values,
  );

  return { pieces: dataResult.rows.map(rowToPiece), total };
}

// Corriger une pièce en anomalie
export async function corrigerPiece(
  cabinetId: string,
  pieceId: string,
  corrections: Record<string, unknown>,
): Promise<Piece | null> {
  const allowed = [
    "type_document", "date_piece", "tiers_nom", "tiers_siret",
    "numero_piece", "montant_ht", "montant_tva", "montant_ttc",
    "taux_tva", "iban", "dossier_id", "periode_id",
  ];

  const fields: string[] = ["statut = 'TRAITEMENT'"];
  const values: unknown[] = [];
  let idx = 1;

  for (const f of allowed) {
    if (corrections[f] !== undefined) {
      fields.push(`${f} = $${idx}`);
      values.push(corrections[f]);
      idx++;
    }
  }

  fields.push("updated_at = now()");
  values.push(pieceId, cabinetId);

  const result = await query(
    `UPDATE pieces SET ${fields.join(", ")}
     WHERE id = $${idx} AND cabinet_id = $${idx + 1} AND statut = 'ANOMALIE'
     RETURNING *`,
    values,
  );
  return result.rows[0] ? rowToPiece(result.rows[0]) : null;
}

// Exécuter le contrôle complet sur une pièce
export async function controlerPiece(cabinetId: string, pieceId: string): Promise<{
  statut: "PRET" | "ANOMALIE";
  controles: ControleLigne[];
}> {
  const piece = await getPiece(cabinetId, pieceId);
  if (!piece) return { statut: "ANOMALIE", controles: [{ code: "PIECE_INTROUVABLE", resultat: "erreur", message: "Pièce non trouvée" }] };

  const controles: ControleLigne[] = [];
  let hasErreur = false;

  // OCR
  if (!piece.ocr_confidence || piece.ocr_confidence < 0.5) {
    controles.push({ code: "FICHIER_ILLISIBLE", resultat: "erreur", message: "OCR trop faible" });
    hasErreur = true;
  }

  // Date
  if (!piece.date_piece) {
    controles.push({ code: "DATE_ABSENTE", resultat: "erreur", message: "Aucune date détectée" });
    hasErreur = true;
  }

  // Montant (sauf relevé)
  if (piece.type_document !== "RELEVE_BANCAIRE" && !piece.montant_ttc) {
    controles.push({ code: "MONTANT_ABSENT", resultat: "erreur", message: "Aucun montant TTC" });
    hasErreur = true;
  }

  // Cohérence HT+TVA=TTC
  if (piece.montant_ht !== null && piece.montant_tva !== null && piece.montant_ttc !== null) {
    if (Math.abs(piece.montant_ht + piece.montant_tva - piece.montant_ttc) > 100) {
      controles.push({ code: "MONTANT_INCOHERENT", resultat: "erreur", message: "HT + TVA ≠ TTC" });
      hasErreur = true;
    }
  }

  // Tiers (factures)
  if ((piece.type_document === "FACTURE_FOURNISSEUR" || piece.type_document === "FACTURE_CLIENT") && !piece.tiers_nom) {
    controles.push({ code: "TIERS_ABSENT", resultat: "erreur", message: "Tiers manquant" });
    hasErreur = true;
  }

  // Numéro pièce (factures)
  if ((piece.type_document === "FACTURE_FOURNISSEUR" || piece.type_document === "FACTURE_CLIENT") && !piece.numero_piece) {
    controles.push({ code: "NUMERO_ABSENT", resultat: "erreur", message: "Numéro de pièce manquant" });
    hasErreur = true;
  }

  // Doublon
  if (piece.tiers_nom && piece.numero_piece && piece.montant_ttc && piece.date_piece && piece.dossier_id) {
    const dup = await query(
      `SELECT id FROM pieces WHERE cabinet_id = $1 AND dossier_id = $2 AND tiers_nom = $3
       AND numero_piece = $4 AND montant_ttc = $5 AND date_piece = $6 AND id != $7 LIMIT 1`,
      [cabinetId, piece.dossier_id, piece.tiers_nom, piece.numero_piece, piece.montant_ttc, piece.date_piece, pieceId],
    );
    if (dup.rowCount && dup.rowCount > 0) {
      controles.push({ code: "DOUBLON", resultat: "erreur", message: `Doublon de ${dup.rows[0].id}` });
      hasErreur = true;
    }
  }

  // IBAN + soldes (relevé)
  if (piece.type_document === "RELEVE_BANCAIRE") {
    if (!piece.iban) { controles.push({ code: "IBAN_ABSENT", resultat: "erreur", message: "IBAN manquant" }); hasErreur = true; }
    if (piece.solde_initial === null || piece.solde_final === null) {
      controles.push({ code: "SOLDES_ABSENTS", resultat: "erreur", message: "Soldes manquants" }); hasErreur = true;
    }
  }

  const statut: "PRET" | "ANOMALIE" = hasErreur ? "ANOMALIE" : "PRET";
  const erreurs = controles.filter(c => c.resultat === "erreur");

  await query(
    `UPDATE pieces SET statut = $3, controle_code = $4, controle_message = $5, warnings = $6, updated_at = now()
     WHERE id = $1 AND cabinet_id = $2`,
    [pieceId, cabinetId, statut, hasErreur ? erreurs[0]?.code ?? "ERREUR" : null, hasErreur ? erreurs[0]?.message ?? "Anomalie" : null, JSON.stringify(controles.filter(c => c.resultat === "warning"))],
  );

  return { statut, controles };
}

// ===== Workflow de traitement complet =====

export async function traiterPiece(cabinetId: string, pieceId: string): Promise<Piece | null> {
  const piece = await getPiece(cabinetId, pieceId);
  if (!piece) return null;

  // Si OCR déjà fait et pièce déjà en TRAITEMENT ou PRET, ne pas retraiter
  if (piece.statut === "PRET") return piece;

  // Note: en V1, l'OCR et le LLM sont appelés par le MCP server.
  // Ici on simule le passage en TRAITEMENT puis on exécute le contrôle
  // sur les données déjà présentes (qui seront remplies par le MCP).
  // Pour le workflow complet, le MCP server doit tourner en parallèle.

  // Si la pièce est en RECU → la passer en TRAITEMENT
  if (piece.statut === "RECU") {
    await query(
      "UPDATE pieces SET statut = 'TRAITEMENT', updated_at = now() WHERE id = $1 AND cabinet_id = $2",
      [pieceId, cabinetId],
    );
  }

  // Si on a déjà des données extraites (type_document, montant), on peut contrôler
  if (piece.type_document && piece.montant_ttc) {
    await controlerPiece(cabinetId, pieceId);
  }

  return getPiece(cabinetId, pieceId);
}

// ===== Transformation ligne DB → Piece =====

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
