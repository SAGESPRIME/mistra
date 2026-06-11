import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { cheminFichier, extensionDe, MIME_PAR_EXTENSION } from "@/lib/fichiers";

// Sert les fichiers uploadés au serveur MCP (contrôle d'accessibilité + OCR).
// HEAD est utilisé par intake_recevoir_fichier pour vérifier l'accès et la taille.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fichierId: string }> },
) {
  const { fichierId } = await params;
  const chemin = cheminFichier(fichierId);
  if (!chemin) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  try {
    const contenu = await readFile(chemin);
    return new NextResponse(new Uint8Array(contenu), {
      headers: {
        "Content-Type": MIME_PAR_EXTENSION[extensionDe(fichierId)] ?? "application/octet-stream",
        "Content-Length": String(contenu.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: Promise<{ fichierId: string }> },
) {
  const { fichierId } = await params;
  const chemin = cheminFichier(fichierId);
  if (!chemin) return new NextResponse(null, { status: 400 });

  try {
    const infos = await stat(chemin);
    return new NextResponse(null, {
      headers: {
        "Content-Type": MIME_PAR_EXTENSION[extensionDe(fichierId)] ?? "application/octet-stream",
        "Content-Length": String(infos.size),
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
