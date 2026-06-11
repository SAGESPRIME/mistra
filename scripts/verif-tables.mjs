// Vérification ponctuelle : liste les tables des schémas "mastra" et "public"
import pgLib from "pg";

const client = new pgLib.Client({
  connectionString: "postgresql://mistra:mistra_dev@localhost:5432/mistra",
});
await client.connect();
const r = await client.query(
  "SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('mastra','public') ORDER BY schemaname, tablename",
);
console.log(r.rows.map((x) => `${x.schemaname}.${x.tablename}`).join("\n"));
await client.end();
