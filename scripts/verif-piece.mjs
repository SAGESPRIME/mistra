// Inspection ponctuelle d'une pièce (debug) : node scripts/verif-piece.mjs <piece_id>
import pgLib from "pg";

const pieceId = process.argv[2];
const db = new pgLib.Client({
  connectionString: "postgresql://mistra:mistra_dev@localhost:5432/mistra",
});
await db.connect();
const r = await db.query(
  `SELECT statut, controle_code, controle_message, type_document, tiers_nom, numero_piece,
          date_piece, montant_ht, montant_tva, montant_ttc, dossier_id, periode_id,
          ocr_confidence, fichier_url, warnings
   FROM pieces WHERE id = $1`,
  [pieceId],
);
console.log(JSON.stringify(r.rows[0] ?? "pièce introuvable", null, 2));
await db.end();
