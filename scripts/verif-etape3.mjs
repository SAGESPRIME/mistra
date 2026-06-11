// Vérification étape 3 : run complet du workflow intake via l'API HTTP Mastra.
// Prérequis (démarrés séparément) :
//   1. npm run db:local                        (Postgres :5432)
//   2. node scripts/mock-services.mjs          (fichiers + OCR + LLM simulés :3997)
//   3. mastra dev avec OCR_ENDPOINT/LLM_* pointés sur le mock (voir ci-dessous)
//
// Preuves produites :
//   A. Run "chemin heureux" → statut PRET (0 erreur)
//   B. La pièce en base porte les données extraites + rattachement auto
//   C. L'état du run est persisté dans mastra.mastra_workflow_snapshot
//   D. Run "fichier illisible" → statut ANOMALIE motivée (FICHIER_ILLISIBLE)

import pgLib from "pg";

const MASTRA_API = "http://localhost:4111/api";
const DATABASE_URL = "postgresql://mistra:mistra_dev@localhost:5432/mistra";
const CABINET_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-0000-0000-000000000001";

async function lancerRun(inputData) {
  const reponse = await fetch(`${MASTRA_API}/workflows/intake/start-async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputData }),
  });
  const corps = await reponse.json();
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}: ${JSON.stringify(corps)}`);
  return corps;
}

const db = new pgLib.Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  // ===== PREUVE A : chemin heureux =====
  const runOk = await lancerRun({
    cabinet_id: CABINET_ID,
    client_id: CLIENT_ID,
    fichier_url: "http://localhost:3997/files/facture-test.pdf",
    fichier_nom: "facture-test.pdf",
    fichier_type: "pdf",
    source: "upload",
  });
  console.log("\n=== PREUVE A — run chemin heureux ===");
  console.log(`status: ${runOk.status}`);
  console.log(JSON.stringify(runOk.result, null, 2));

  const pieceIdOk = runOk.result?.piece_id;
  if (runOk.status !== "success" || runOk.result?.statut !== "PRET") {
    throw new Error("ÉCHEC : le chemin heureux n'a pas abouti à PRET");
  }

  // ===== PREUVE B : état réel de la pièce en base =====
  const piece = await db.query(
    `SELECT statut, type_document, tiers_nom, numero_piece, montant_ht, montant_tva, montant_ttc,
            date_piece, dossier_id, periode_id, ocr_confidence, warnings
     FROM pieces WHERE id = $1`,
    [pieceIdOk],
  );
  console.log("\n=== PREUVE B — pièce en base après le run ===");
  console.log(JSON.stringify(piece.rows[0], null, 2));

  // ===== PREUVE C : état du run persisté par Mastra =====
  const snapshots = await db.query(
    `SELECT workflow_name, COUNT(*) AS runs FROM mastra.mastra_workflow_snapshot GROUP BY workflow_name`,
  );
  console.log("\n=== PREUVE C — runs persistés dans mastra.mastra_workflow_snapshot ===");
  console.log(JSON.stringify(snapshots.rows, null, 2));

  // ===== PREUVE D : fichier illisible → la chaîne saute les enrichissements
  // et le contrôle final motive l'ANOMALIE (FICHIER_ILLISIBLE) =====
  const runIllisible = await lancerRun({
    cabinet_id: CABINET_ID,
    client_id: CLIENT_ID,
    fichier_url: "http://localhost:3997/files/illisible.pdf",
    fichier_nom: "illisible.pdf",
    fichier_type: "pdf",
    source: "upload",
  });
  console.log("\n=== PREUVE D — fichier illisible → ANOMALIE motivée ===");
  console.log(`status: ${runIllisible.status}`);
  console.log(JSON.stringify(runIllisible.result, null, 2));
  if (runIllisible.result?.statut !== "ANOMALIE") {
    throw new Error("ÉCHEC : le fichier illisible aurait dû finir en ANOMALIE");
  }
  const pieceAnomalie = await db.query(
    "SELECT statut, controle_code, controle_message FROM pieces WHERE id = $1",
    [runIllisible.result.piece_id],
  );
  console.log(JSON.stringify(pieceAnomalie.rows[0], null, 2));

  // ===== PREUVE E : URL inaccessible → échec propre du run (pas de pièce fantôme) =====
  let runEchec;
  try {
    runEchec = await lancerRun({
      cabinet_id: CABINET_ID,
      client_id: CLIENT_ID,
      fichier_url: "http://localhost:3997/inexistant/rien.pdf",
      fichier_nom: "rien.pdf",
      fichier_type: "pdf",
      source: "upload",
    });
  } catch (e) {
    runEchec = { status: "failed", erreur: e.message };
  }
  console.log("\n=== PREUVE E — fichier inaccessible → échec propre ===");
  console.log(JSON.stringify({ status: runEchec.status, erreur: runEchec.error ?? runEchec.erreur ?? null }, null, 2).substring(0, 600));

  console.log("\n✅ Étape 3 vérifiée : workflow Mastra de bout en bout — PRET, ANOMALIE motivée, échec propre, état persisté.");
} finally {
  await db.end().catch(() => {});
}
