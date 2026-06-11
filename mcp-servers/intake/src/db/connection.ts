import pg from "pg";

const { Pool } = pg;

// Parseurs de types pg — corrigés ici UNE SEULE FOIS pour tout le serveur :
// - DATE (1082) : chaîne "YYYY-MM-DD" au lieu d'objet Date JS (rattacher, contrôles, type Piece)
// - BIGINT (20) : number au lieu de chaîne — sinon "10000" + "2000" concatène au lieu
//   d'additionner et le contrôle HT+TVA=TTC échoue à tort (montants en centimes,
//   très loin de la limite Number.MAX_SAFE_INTEGER)
// - NUMERIC (1700) : number au lieu de chaîne (ocr_confidence, moyennes)
pg.types.setTypeParser(1082, (valeur) => valeur);
pg.types.setTypeParser(20, (valeur) => parseInt(valeur, 10));
pg.types.setTypeParser(1700, (valeur) => parseFloat(valeur));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  // stderr obligatoire : en transport stdio, stdout est réservé au protocole JSON-RPC
  console.error(JSON.stringify({
    level: "debug",
    query: text.substring(0, 200),
    duration_ms: duration,
    rows: result.rowCount,
  }));
  return result;
}

export async function getClient() {
  return pool.connect();
}

export default pool;
