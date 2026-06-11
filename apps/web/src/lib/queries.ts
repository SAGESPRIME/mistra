// Lectures Postgres pour l'AFFICHAGE uniquement — aucune écriture, aucune logique métier.
// Toutes les écritures (création, correction, contrôle) passent par les workflows
// Mastra et les tools MCP (voir mastra-client.ts).

import pg from "pg";
import type { Piece, ControleLigne, PieceStatut, DocumentType } from "@mistra/shared";

const { Pool } = pg;

// Parseurs de types pg (mêmes correctifs que mcp-servers/intake/src/db/connection.ts) :
// DATE en chaîne "YYYY-MM-DD", BIGINT et NUMERIC en number — sans ça les montants
// reviennent en chaînes et "10000" + "2000" concatène au lieu d'additionner
pg.types.setTypeParser(1082, (valeur) => valeur);
pg.types.setTypeParser(20, (valeur) => parseInt(valeur, 10));
pg.types.setTypeParser(1700, (valeur) => parseFloat(valeur));

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

async function query(text: string, params?: unknown[]) {
  return getPool().query(text, params);
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
