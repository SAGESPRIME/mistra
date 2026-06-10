import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(JSON.stringify({
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
