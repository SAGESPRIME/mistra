// Service LLM — Classification et extraction via LLM

const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "";
const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o";

interface LlmResponse<T> {
  data: T;
  confidence: number;
}

// Classifier un document
export async function classifier(texte: string): Promise<LlmResponse<string>> {
  const prompt = `Tu es un classifieur de documents comptables français.
Classe ce document dans UNE de ces catégories :
- FACTURE_FOURNISSEUR : facture reçue d'un fournisseur
- FACTURE_CLIENT : facture émise à un client
- NOTE_DE_FRAIS : note de frais / ticket / reçu employé
- RELEVE_BANCAIRE : relevé de compte bancaire

Réponds UNIQUEMENT avec le nom de la catégorie, rien d'autre.

Texte du document :
${texte.substring(0, 3000)}`;

  const response = await callLlm(prompt);
  const types = ["FACTURE_FOURNISSEUR", "FACTURE_CLIENT", "NOTE_DE_FRAIS", "RELEVE_BANCAIRE"];
  const type = types.find(t => response.includes(t)) ?? "";

  return {
    data: type,
    confidence: type ? 0.9 : 0.3,
  };
}

// Extraire les données structurées
export async function extraire(texte: string, typeDocument: string): Promise<LlmResponse<Record<string, unknown>>> {
  const champsSpecifiques = getChampsPrompt(typeDocument);

  const prompt = `Tu es un extracteur de données comptables françaises.
Extrais les données suivantes de ce document ${typeDocument}.
${champsSpecifiques}

Règles :
- Les montants doivent être en CENTIMES (ex: 150.50€ → 15050)
- Les taux en POINTS DE BASE (ex: 20% → 2000)
- Les dates au format YYYY-MM-DD
- Si une information est illisible ou absente, mets null

Réponds UNIQUEMENT en JSON valide, pas de texte avant ou après.

Texte du document :
${texte.substring(0, 5000)}`;

  const response = await callLlm(prompt);

  try {
    // Extraire le JSON de la réponse (peut être entouré de ```json ... ```)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { data: {}, confidence: 0.3 };
    }
    const data = JSON.parse(jsonMatch[0]);
    return { data, confidence: 0.85 };
  } catch {
    return { data: {}, confidence: 0.3 };
  }
}

function getChampsPrompt(typeDocument: string): string {
  const champsCommuns = `
Champs communs :
- date_piece (YYYY-MM-DD)
- date_echeance (YYYY-MM-DD, si présente)
- tiers_nom (nom du fournisseur/client/employé)
- tiers_siret (numéro SIRET si visible)
- numero_piece (numéro de facture/pièce)
- description (résumé en quelques mots)
- montant_ht (centimes)
- montant_tva (centimes)
- montant_ttc (centimes)
- taux_tva (points de base, ex: 2000 pour 20%)`;

  switch (typeDocument) {
    case "RELEVE_BANCAIRE":
      return `Champs spécifiques relevé bancaire :
- iban
- solde_initial (centimes)
- solde_final (centimes)
- date_piece = date de début du relevé
- tiers_nom = nom de la banque`;
    case "NOTE_DE_FRAIS":
      return `${champsCommuns}
Champs spécifiques note de frais :
- tiers_nom = nom de l'employé si visible`;
    default:
      return champsCommuns;
  }
}

async function callLlm(prompt: string): Promise<string> {
  const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}
