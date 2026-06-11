// Serveur de simulation pour tester le pipeline SANS Docker ni clé LLM réelle.
// Joue 3 rôles sur le port 3997 :
//   - GET/HEAD /files/*.pdf            → sert un faux PDF (pour recevoir_fichier + OCR)
//   - POST /forms/pdfengines/convert   → joue Gotenberg : renvoie le texte d'une facture
//   - POST /v1/chat/completions        → joue le LLM : classification ou extraction prédéfinies
//
// Usage : node scripts/mock-services.mjs   (utilisé par verif-etape3.mjs)

import { createServer } from "node:http";

const PORT = 3997;

// Texte de facture renvoyé par le faux OCR (> 500 caractères → confiance 0.9)
const TEXTE_FACTURE = `FACTURE
SARL Fournitures Dupont
12 rue des Artisans, 75011 Paris
SIRET : 98765432109876

Facturé à : Boulangerie Dupont
Date de facture : 15/03/2025
Numéro de facture : FAC-2025-042
Échéance : 15/04/2025

Désignation                          Qté    PU HT      Total HT
Ramettes papier A4 80g               10     5,00 €     50,00 €
Cartouches encre noire                4     7,50 €     30,00 €
Classeurs à levier                   10     2,00 €     20,00 €

Total HT :                                             100,00 €
TVA 20% :                                               20,00 €
Total TTC :                                            120,00 €

Conditions de règlement : 30 jours fin de mois.
Pénalités de retard : 3 fois le taux d'intérêt légal.
Pas d'escompte pour règlement anticipé.
`;

// Réponses prédéfinies du faux LLM
const REPONSE_CLASSIFICATION = "FACTURE_FOURNISSEUR";
const REPONSE_EXTRACTION = JSON.stringify({
  date_piece: "2025-03-15",
  date_echeance: "2025-04-15",
  tiers_nom: "SARL Fournitures Dupont",
  tiers_siret: "98765432109876",
  numero_piece: "FAC-2025-042",
  description: "Fournitures de bureau",
  montant_ht: 10000,
  montant_tva: 2000,
  montant_ttc: 12000,
  taux_tva: 2000,
});

// Faux PDF : on embarque le nom du fichier demandé dans le contenu, ce qui permet
// au faux Gotenberg de savoir quel document on lui envoie (cas "illisible" vs normal)
function fauxPdf(url) {
  return Buffer.from(`%PDF-1.4 faux document de test mistra ${url}\n%%EOF`, "latin1");
}

function lireCorps(req) {
  return new Promise((resolve) => {
    const morceaux = [];
    req.on("data", (m) => morceaux.push(m));
    req.on("end", () => resolve(Buffer.concat(morceaux).toString("utf8")));
  });
}

const serveur = createServer(async (req, res) => {
  const url = req.url ?? "";

  // Fichiers de test
  if (url.startsWith("/files/")) {
    const pdf = fauxPdf(url);
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
    });
    res.end(req.method === "HEAD" ? undefined : pdf);
    return;
  }

  // Faux Gotenberg : texte court pour un fichier "illisible", facture sinon
  if (url.startsWith("/forms/pdfengines/convert")) {
    const corps = await lireCorps(req);
    const texte = corps.includes("illisible") ? "??" : TEXTE_FACTURE;
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(texte);
    return;
  }

  // Faux LLM (API compatible OpenAI)
  if (url.startsWith("/v1/chat/completions")) {
    const corps = await lireCorps(req);
    const estClassification = corps.includes("classifieur");
    const contenu = estClassification ? REPONSE_CLASSIFICATION : REPONSE_EXTRACTION;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: contenu } }] }));
    return;
  }

  res.writeHead(404);
  res.end("introuvable");
});

serveur.listen(PORT, () => {
  console.log(`Mock services prêt sur http://localhost:${PORT} (fichiers + OCR + LLM)`);
});
