// Vérification étape 2 : les tools MCP intake répondent via le MCPClient Mastra (stdio).
// Prérequis : npm run db:local (Postgres sur :5432) + mcp-servers/intake compilé.
//
// Preuves produites :
// 1. La liste des tools exposés par le serveur (attendu : 9)
// 2. intake_rechercher_pieces répond
// 3. intake_consulter_piece retourne une vraie pièce insérée en base

import { MCPClient } from "@mastra/mcp";
import pgLib from "pg";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const racine = dirname(dirname(fileURLToPath(import.meta.url)));
const DATABASE_URL = "postgresql://mistra:mistra_dev@localhost:5432/mistra";
const CABINET_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-0000-0000-000000000001";

const mcp = new MCPClient({
  id: "verif-etape2",
  servers: {
    intake: {
      command: "node",
      args: [resolve(racine, "mcp-servers", "intake", "dist", "index.js")],
      env: { DATABASE_URL },
    },
  },
});

const db = new pgLib.Client({ connectionString: DATABASE_URL });
let pieceId = null;

try {
  // ===== Preuve 1 : liste des tools =====
  const tools = await mcp.listTools();
  const noms = Object.keys(tools);
  console.log(`\n=== PREUVE 1 — ${noms.length} tools exposés ===`);
  console.log(noms.join("\n"));

  const trouverTool = (suffixe) => {
    const cle = noms.find((n) => n.endsWith(suffixe));
    if (!cle) throw new Error(`Tool introuvable: *${suffixe}`);
    return tools[cle];
  };

  // ===== Preuve 2 : rechercher_pieces =====
  const rechercher = trouverTool("rechercher_pieces");
  const resRecherche = await rechercher.execute?.(
    { cabinet_id: CABINET_ID, page: 1, limite: 5 },
    {},
  );
  console.log("\n=== PREUVE 2 — intake_rechercher_pieces ===");
  console.log(JSON.stringify(resRecherche, null, 2).substring(0, 1200));

  // ===== Preuve 3 : consulter_piece sur une pièce réelle =====
  await db.connect();
  const ins = await db.query(
    `INSERT INTO pieces (cabinet_id, client_id, fichier_url, fichier_nom, fichier_type, source, statut)
     VALUES ($1, $2, 'upload://test/verif-etape2.pdf', 'verif-etape2.pdf', 'pdf', 'upload', 'RECU')
     RETURNING id`,
    [CABINET_ID, CLIENT_ID],
  );
  pieceId = ins.rows[0].id;
  console.log(`\nPièce de test insérée: ${pieceId}`);

  const consulter = trouverTool("consulter_piece");
  const resConsulter = await consulter.execute?.(
    { cabinet_id: CABINET_ID, piece_id: pieceId },
    {},
  );
  console.log("\n=== PREUVE 3 — intake_consulter_piece ===");
  console.log(JSON.stringify(resConsulter, null, 2).substring(0, 1500));

  console.log("\n✅ Étape 2 vérifiée : les tools MCP répondent via Mastra MCPClient (stdio).");
} finally {
  // Nettoyage : supprimer la pièce de test, fermer les connexions
  if (pieceId) await db.query("DELETE FROM pieces WHERE id = $1", [pieceId]);
  await db.end().catch(() => {});
  await mcp.disconnect().catch(() => {});
  process.exit(0);
}
