// Service stockage — Gestion des fichiers via S3-compatible (MinIO)

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? "";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? "";
const S3_BUCKET = process.env.S3_BUCKET ?? "pieces";

export async function verifierFichierAccessible(fichierUrl: string): Promise<boolean> {
  try {
    const response = await fetch(fichierUrl, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getTailleFichier(fichierUrl: string): Promise<number> {
  try {
    const response = await fetch(fichierUrl, { method: "HEAD" });
    const contentLength = response.headers.get("content-length");
    return contentLength ? parseInt(contentLength, 10) : 0;
  } catch {
    return 0;
  }
}

export function genererUrlStockage(fichierNom: string, cabinetId: string): string {
  const cleanNom = fichierNom.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${S3_ENDPOINT}/${S3_BUCKET}/${cabinetId}/${Date.now()}-${cleanNom}`;
}
