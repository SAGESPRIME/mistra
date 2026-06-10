// Service OCR — Appelle Gotenberg pour extraire le texte d'un fichier

const OCR_ENDPOINT = process.env.OCR_ENDPOINT ?? "http://localhost:3020";

export interface OcrResult {
  texte: string;
  confidence: number;
  pages: number;
}

export async function analyserFichier(fichierUrl: string): Promise<OcrResult> {
  try {
    // Étape 1 : Télécharger le fichier
    const fileResponse = await fetch(fichierUrl);
    if (!fileResponse.ok) {
      throw new Error(`Impossible de télécharger le fichier: ${fileResponse.status}`);
    }
    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

    // Étape 2 : Envoyer à Gotenberg pour OCR
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append("files", blob, "document.pdf");

    const ocrResponse = await fetch(`${OCR_ENDPOINT}/forms/pdfengines/convert`, {
      method: "POST",
      body: formData,
    });

    if (!ocrResponse.ok) {
      // Fallback : tentative d'extraction texte simple
      return fallbackOcr(fichierUrl);
    }

    const ocrBuffer = Buffer.from(await ocrResponse.arrayBuffer());
    const texte = ocrBuffer.toString("utf-8");

    // Estimer la confiance basée sur la quantité de texte extrait
    const confidence = estimerConfiance(texte);
    const pages = estimerPages(texte);

    return { texte, confidence, pages };
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "ocr",
      erreur: error instanceof Error ? error.message : "Erreur inconnue",
    }));
    throw error;
  }
}

// Fallback OCR : extraction basique si Gotenberg échoue
async function fallbackOcr(fichierUrl: string): Promise<OcrResult> {
  const response = await fetch(fichierUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  // Pour les PDF, tenter d'extraire le texte brut
  const texte = buffer.toString("utf-8")
    .replace(/[^\x20-\x7E\n\ràâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, "")
    .substring(0, 50000);

  const confidence = estimerConfiance(texte);

  return { texte, confidence, pages: 1 };
}

function estimerConfiance(texte: string): number {
  if (texte.length < 20) return 0.2;
  if (texte.length < 100) return 0.5;
  if (texte.length < 500) return 0.7;
  return 0.9;
}

function estimerPages(texte: string): number {
  // Estimation grossière : ~3000 caractères par page
  return Math.max(1, Math.ceil(texte.length / 3000));
}
