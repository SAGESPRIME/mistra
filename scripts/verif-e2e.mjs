// Vérification de BOUT EN BOUT de la chaîne de production comptable (V1).
// Rejoue les 4 scénarios métier via l'API web — exactement ce que fait l'interface.
//
// Prérequis (4 services démarrés) :
//   1. npm run db:local                  (Postgres :5432)
//   2. node scripts/mock-services.mjs    (fichiers + OCR + LLM simulés :3997)
//   3. npm run dev:mastra                (avec OCR_ENDPOINT/LLM_* pointés sur :3997)
//   4. npm run dev                       (Next.js :3000)
//
// Scénarios :
//   1. Upload facture           → PRET (pipeline complet, rattachement auto)
//   2. Upload la même facture   → ANOMALIE DOUBLON
//   3. Correction du doublon    → PRET (workflow recontrole)
//   4. Upload scan illisible    → ANOMALIE FICHIER_ILLISIBLE
//   + état final cohérent (liste + runs persistés)

import pgLib from "pg";

const WEB = "http://localhost:3000";
const CABINET_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-0000-0000-000000000001";

let echecs = 0;

function verifier(nom, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${nom}`);
  } else {
    echecs++;
    console.log(`  ❌ ${nom} — obtenu: ${JSON.stringify(detail)}`);
  }
}

async function uploader(nomFichier, contenu) {
  const form = new FormData();
  form.append("file", new Blob([contenu], { type: "application/pdf" }), nomFichier);
  form.append("cabinet_id", CABINET_ID);
  form.append("client_id", CLIENT_ID);
  const res = await fetch(`${WEB}/api/upload`, { method: "POST", body: form });
  return { http: res.status, ...(await res.json()) };
}

const db = new pgLib.Client({
  connectionString: "postgresql://mistra:mistra_dev@localhost:5432/mistra",
});
await db.connect();

try {
  // Base propre pour un résultat déterministe
  await db.query("DELETE FROM pieces");
  console.log("Base nettoyée.\n");

  // ===== Scénario 1 : facture → PRET =====
  console.log("Scénario 1 — upload facture :");
  const s1 = await uploader("facture-mars.pdf", "%PDF-1.4 facture de test e2e\n%%EOF");
  verifier("HTTP 200", s1.http === 200, s1);
  verifier("statut PRET", s1.statut === "PRET", s1);
  verifier("0 erreur", s1.erreurs_count === 0, s1);

  const piece1 = (await db.query("SELECT * FROM pieces WHERE id = $1", [s1.piece_id])).rows[0];
  verifier("type FACTURE_FOURNISSEUR", piece1?.type_document === "FACTURE_FOURNISSEUR", piece1?.type_document);
  verifier("montants extraits (HT+TVA=TTC)", piece1?.montant_ht === "10000" && piece1?.montant_ttc === "12000", piece1?.montant_ttc);
  verifier("rattachée à un dossier", piece1?.dossier_id !== null, piece1?.dossier_id);
  verifier("rattachée à une période", piece1?.periode_id !== null, piece1?.periode_id);

  // ===== Scénario 2 : même facture → DOUBLON =====
  console.log("\nScénario 2 — re-upload de la même facture :");
  const s2 = await uploader("facture-mars-copie.pdf", "%PDF-1.4 copie de la facture e2e\n%%EOF");
  verifier("statut ANOMALIE", s2.statut === "ANOMALIE", s2);
  verifier("code DOUBLON", s2.controle_code === "DOUBLON", s2);

  // ===== Scénario 3 : correction du doublon → PRET =====
  console.log("\nScénario 3 — correction du numéro de pièce puis recontrôle :");
  const res3 = await fetch(`${WEB}/api/pieces/${s2.piece_id}/corriger`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cabinet_id: CABINET_ID,
      corrections: { numero_piece: "FAC-2025-E2E" },
    }),
  });
  const s3 = { http: res3.status, ...(await res3.json()) };
  verifier("HTTP 200", s3.http === 200, s3);
  verifier("statut PRET après correction", s3.statut === "PRET", s3);
  verifier("champ corrigé tracé", s3.champs_corriges?.includes("numero_piece"), s3.champs_corriges);

  // ===== Scénario 4 : scan illisible → ANOMALIE motivée =====
  console.log("\nScénario 4 — upload d'un scan illisible :");
  const s4 = await uploader("scan-rate.pdf", "%PDF-1.4 document illisible e2e\n%%EOF");
  verifier("statut ANOMALIE", s4.statut === "ANOMALIE", s4);
  verifier("code FICHIER_ILLISIBLE", s4.controle_code === "FICHIER_ILLISIBLE", s4);

  // ===== État final =====
  console.log("\nÉtat final :");
  const liste = await (await fetch(`${WEB}/api/pieces?cabinet_id=${CABINET_ID}&limite=10`)).json();
  verifier("3 pièces au total", liste.total === 3, liste.total);
  const statuts = liste.pieces.map((p) => p.statut).sort().join(",");
  verifier("2 PRET + 1 ANOMALIE", statuts === "ANOMALIE,PRET,PRET", statuts);

  const runs = await db.query(
    "SELECT workflow_name, COUNT(*) AS n FROM mastra.mastra_workflow_snapshot WHERE workflow_name IN ('intake','recontrole') GROUP BY workflow_name ORDER BY workflow_name",
  );
  console.log(`  ℹ️  runs persistés : ${runs.rows.map((r) => `${r.workflow_name}=${r.n}`).join(", ")}`);

  console.log(
    echecs === 0
      ? "\n✅✅ E2E COMPLET : la chaîne de production comptable V1 fonctionne de bout en bout."
      : `\n❌ ${echecs} vérification(s) en échec.`,
  );
  process.exitCode = echecs === 0 ? 0 : 1;
} finally {
  await db.end().catch(() => {});
}
