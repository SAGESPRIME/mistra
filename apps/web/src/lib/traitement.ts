// Pipeline de traitement complet pour une pièce
// Étapes : OCR → classification → extraction de données → contrôle
// Ce module remplace le stub traiterPiece qui était dans db.ts
// Il appelle directement Gotenberg (OCR) et le LLM configuré dans les variables d'env.

import { query, controlerPiece } from "./db";

const OCR_ENDPOINT = process.env.OCR_ENDPOINT ?? "http://localhost:3020";
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o";

// ===== Point d'entrée =====

export async function traiterPiece(cabinetId: string, pieceId: string): Promise<void> {
  // Passer en TRAITEMENT
  await query(
    "UPDATE pieces SET statut = 'TRAITEMENT', updated_at = now() WHERE id = $1 AND cabinet_id = $2 AND statut = 'RECU'",
    [pieceId, cabinetId],
  );

  // Récupérer la pièce
  const res = await query(
    "SELECT id, fichier_url, fichier_type FROM pieces WHERE id = $1 AND cabinet_id = $2",
    [pieceId, cabinetId],
  );
  const piece = res.rows[0] as { id: string; fichier_url: string; fichier_type: string } | undefined;
  if (!piece) return;

  try {
    // Étape 1 : OCR
    const { texte, confidence, pages } = await doOcr(piece.fichier_url, piece.fichier_type);

    await query(
      `UPDATE pieces SET ocr_texte = $1, ocr_confidence = $2, ocr_pages = $3, updated_at = now()
       WHERE id = $4 AND cabinet_id = $5`,
      [texte, confidence, pages, pieceId, cabinetId],
    );

    if (confidence < 0.4) {
      await query(
        `UPDATE pieces SET statut = 'ANOMALIE', controle_code = 'FICHIER_ILLISIBLE',
         controle_message = 'Texte illisible ou trop court (confiance OCR: ${confidence.toFixed(2)})', updated_at = now()
         WHERE id = $1 AND cabinet_id = $2`,
        [pieceId, cabinetId],
      );
      return;
    }

    if (!LLM_API_KEY) {
      // Pas de LLM configuré : anomalie informative
      await query(
        `UPDATE pieces SET statut = 'ANOMALIE', controle_code = 'LLM_NON_CONFIGURE',
         controle_message = 'LLM_API_KEY manquante — classification impossible', updated_at = now()
         WHERE id = $1 AND cabinet_id = $2`,
        [pieceId, cabinetId],
      );
      return;
    }

    // Étape 2 : Classification
    const typeDocument = await doClassifier(texte);
    await query(
      "UPDATE pieces SET type_document = $1, updated_at = now() WHERE id = $2 AND cabinet_id = $3",
      [typeDocument, pieceId, cabinetId],
    );

    // Étape 3 : Extraction des données structurées
    const donnees = await doExtraire(texte, typeDocument);
    await updateDonnees(cabinetId, pieceId, donnees);

    // Étape 4 : Contrôle final (calcule le statut PRET ou ANOMALIE)
    await controlerPiece(cabinetId, pieceId);
  } catch (error) {
    console.error(`[traitement] Erreur pièce ${pieceId}:`, error);
    const message = error instanceof Error ? error.message.substring(0, 200) : "Erreur inconnue";
    await query(
      `UPDATE pieces SET statut = 'ANOMALIE', controle_code = 'ERREUR_TRAITEMENT',
       controle_message = $1, updated_at = now()
       WHERE id = $2 AND cabinet_id = $3`,
      [message, pieceId, cabinetId],
    );
  }
}

// ===== OCR via Gotenberg =====

async function doOcr(
  fichierUrl: string,
  fichierType: string,
): Promise<{ texte: string; confidence: number; pages: number }> {
  // Téléchargement du fichier depuis MinIO
  const response = await fetch(fichierUrl);
  if (!response.ok) {
    throw new Error(`Fichier inaccessible (HTTP ${response.status}): ${fichierUrl}`);
  }
  const fileBuffer = Buffer.from(await response.arrayBuffer());

  // Essai avec Gotenberg (sans AbortSignal pour compatibilité TypeScript)
  try {
    const formData = new FormData();
    const mimeType = fichierType === "pdf" ? "application/pdf" : `image/${fichierType}`;
    const nom = fichierType === "pdf" ? "document.pdf" : `document.${fichierType}`;
    formData.append("files", new Blob([fileBuffer], { type: mimeType }), nom);

    const ocrRes = await fetch(`${OCR_ENDPOINT}/forms/pdfengines/convert`, {
      method: "POST",
      body: formData,
    });

    if (ocrRes.ok) {
      const buf = Buffer.from(await ocrRes.arrayBuffer());
      const texte = extraireTexteBuffer(buf);
      if (texte.length > 50) {
        return { texte, confidence: estimerConfiance(texte), pages: estimerPages(texte) };
      }
    }
  } catch {
    // Gotenberg indisponible → fallback
  }

  // Fallback : extraction directe du buffer (fonctionne pour les PDF natifs avec texte embarqué)
  const texte = extraireTexteBuffer(fileBuffer);
  return { texte, confidence: estimerConfiance(texte), pages: 1 };
}

function extraireTexteBuffer(buf: Buffer): string {
  return buf
    .toString("latin1")
    .replace(/[^\x20-\x7E\n\ràâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, " ")
    .replace(/ {3,}/g, " ")
    .trim()
    .substring(0, 50_000);
}

function estimerConfiance(texte: string): number {
  if (texte.length < 20) return 0.2;
  if (texte.length < 100) return 0.5;
  if (texte.length < 500) return 0.7;
  return 0.9;
}

function estimerPages(texte: string): number {
  return Math.max(1, Math.ceil(texte.length / 3_000));
}

// ===== Classification LLM =====

async function doClassifier(texte: string): Promise<string> {
  const prompt = `Tu es un classifieur de documents comptables français.
Classe ce document dans UNE de ces catégories :
- FACTURE_FOURNISSEUR : facture reçue d'un fournisseur
- FACTURE_CLIENT : facture émise à un client
- NOTE_DE_FRAIS : note de frais / ticket / reçu employé
- RELEVE_BANCAIRE : relevé de compte bancaire

Réponds UNIQUEMENT avec le nom de la catégorie, rien d'autre.

Texte du document :
${texte.substring(0, 3_000)}`;

  const reponse = await callLlm(prompt);
  const types = ["FACTURE_FOURNISSEUR", "FACTURE_CLIENT", "NOTE_DE_FRAIS", "RELEVE_BANCAIRE"];
  return types.find((t) => reponse.includes(t)) ?? "FACTURE_FOURNISSEUR";
}

// ===== Extraction LLM =====

async function doExtraire(texte: string, typeDocument: string): Promise<Record<string, unknown>> {
  const champsCommuns = `
Champs à extraire :
- date_piece (YYYY-MM-DD)
- date_echeance (YYYY-MM-DD, si présente)
- tiers_nom (nom du fournisseur / client / employé)
- tiers_siret (numéro SIRET si visible)
- numero_piece (numéro de facture / pièce)
- description (résumé en quelques mots)
- montant_ht (entier en centimes, ex: 150.50€ → 15050)
- montant_tva (entier en centimes)
- montant_ttc (entier en centimes)
- taux_tva (entier en points de base, ex: 20% → 2000)`;

  const champsSpecifiques =
    typeDocument === "RELEVE_BANCAIRE"
      ? `
Champs spécifiques relevé bancaire :
- iban (numéro IBAN)
- solde_initial (entier en centimes)
- solde_final (entier en centimes)
- date_piece = date de début du relevé
- tiers_nom = nom de la banque`
      : champsCommuns;

  const prompt = `Tu es un extracteur de données comptables françaises.
Extrais les données suivantes de ce document (type: ${typeDocument}).
${champsSpecifiques}

Règles importantes :
- Montants en CENTIMES (entiers), taux en POINTS DE BASE (entiers)
- Dates au format YYYY-MM-DD
- Si une information est absente ou illisible, mets null
- Réponds UNIQUEMENT en JSON valide, sans texte autour

Texte du document :
${texte.substring(0, 5_000)}`;

  const reponse = await callLlm(prompt);

  try {
    const match = reponse.match(/\{[\s\S]*\}/);
    if (!match) return {};
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ===== Mise à jour DB des données extraites =====

async function updateDonnees(
  cabinetId: string,
  pieceId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const champs = [
    "date_piece", "date_echeance", "tiers_nom", "tiers_siret", "numero_piece",
    "description", "montant_ht", "montant_tva", "montant_ttc", "taux_tva",
    "iban", "solde_initial", "solde_final",
  ];

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const champ of champs) {
    if (data[champ] !== undefined && data[champ] !== null) {
      sets.push(`${champ} = $${idx}`);
      values.push(data[champ]);
      idx++;
    }
  }

  if (sets.length === 0) return;

  sets.push("updated_at = now()");
  values.push(pieceId, cabinetId);

  await query(
    `UPDATE pieces SET ${sets.join(", ")} WHERE id = $${idx} AND cabinet_id = $${idx + 1}`,
    values,
  );
}

// ===== Appel LLM générique =====

async function callLlm(prompt: string): Promise<string> {
  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2_000,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM API error ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
