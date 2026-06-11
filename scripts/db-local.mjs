// Postgres local embarqué — pour développer sans Docker.
// Démarre un Postgres sur le port 5432 avec les mêmes identifiants que docker-compose
// (mistra / mistra_dev / base "mistra") et applique scripts/schema.sql au premier démarrage.
//
// Usage : npm run db:local   (Ctrl+C pour arrêter proprement)

import EmbeddedPostgres from "embedded-postgres";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pgLib from "pg";

const racine = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(racine, "data", "postgres");
const premierDemarrage = !existsSync(DATA_DIR);

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "mistra",
  password: "mistra_dev",
  port: 5432,
  persistent: true,
  // UTF8 explicite : sans ça, initdb hérite de la locale Windows (WIN1252)
  // et les caractères comme ≠ € dans les messages de contrôle font planter les INSERT
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (premierDemarrage) {
  console.log("Premier démarrage : initialisation du cluster Postgres...");
  await pg.initialise();
}

await pg.start();
console.log("Postgres démarré sur localhost:5432 (user: mistra)");

if (premierDemarrage) {
  await pg.createDatabase("mistra");
  console.log('Base "mistra" créée.');

  const schemaSql = await readFile(join(racine, "scripts", "schema.sql"), "utf8");
  const client = new pgLib.Client({
    connectionString: "postgresql://mistra:mistra_dev@localhost:5432/mistra",
  });
  await client.connect();
  await client.query(schemaSql);
  await client.end();
  console.log("Schéma métier appliqué (scripts/schema.sql).");
}

console.log("Prêt. Ctrl+C pour arrêter.");

async function arreter() {
  console.log("Arrêt de Postgres...");
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", arreter);
process.on("SIGTERM", arreter);
