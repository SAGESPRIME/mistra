// Stockage des fichiers uploadés sur le disque local (volume Docker en prod).
// Les fichiers sont servis par GET /api/fichiers/[fichierId] — c'est par cette
// URL que le serveur MCP (OCR) télécharge la pièce.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");

// URL de base par laquelle le serveur MCP atteint cette app
// (dev : localhost:3000 ; Docker : http://web:3000)
const FICHIERS_BASE_URL = process.env.FICHIERS_BASE_URL ?? "http://localhost:3000";

const EXTENSIONS_VALIDES = ["pdf", "jpeg", "png", "webp"] as const;

export const MIME_PAR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function enregistrerFichier(
  buffer: Buffer,
  fichierType: string,
): Promise<{ fichierId: string; url: string }> {
  const fichierId = `${randomUUID()}.${fichierType}`;
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(join(UPLOADS_DIR, fichierId), buffer);
  return { fichierId, url: `${FICHIERS_BASE_URL}/api/fichiers/${fichierId}` };
}

// Retourne le chemin disque d'un fichier, ou null si l'identifiant est invalide
// (protection contre la traversée de chemin : uuid.extension uniquement)
export function cheminFichier(fichierId: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpeg|png|webp)$/.test(fichierId)) {
    return null;
  }
  return join(UPLOADS_DIR, fichierId);
}

export function extensionDe(fichierId: string): (typeof EXTENSIONS_VALIDES)[number] {
  return fichierId.split(".").pop() as (typeof EXTENSIONS_VALIDES)[number];
}
