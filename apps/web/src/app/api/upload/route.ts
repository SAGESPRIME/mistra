import { NextRequest, NextResponse } from "next/server";
import { createPiece, traiterPiece } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const cabinetId = formData.get("cabinet_id") as string;
    const clientId = formData.get("client_id") as string;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    }
    if (!cabinetId || !clientId) {
      return NextResponse.json({ error: "cabinet_id et client_id requis" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (> 20 Mo)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowedTypes = ["pdf", "jpeg", "jpg", "png", "webp"];
    if (!ext || !allowedTypes.includes(ext)) {
      return NextResponse.json({ error: "Format non supporté" }, { status: 400 });
    }

    const fichierType = ext === "jpg" ? "jpeg" : ext;

    // Stocker dans MinIO (V1: URL locale, sera remplacé par vrai upload S3)
    const fichierUrl = `local://${cabinetId}/${Date.now()}-${file.name}`;

    // Créer la pièce en base
    const piece = await createPiece({
      cabinet_id: cabinetId,
      client_id: clientId,
      fichier_url: fichierUrl,
      fichier_nom: file.name,
      fichier_type: fichierType,
      source: "upload",
    });

    // Lancer le traitement en arrière-plan
    // Le MCP server fera l'OCR + classification + extraction + contrôle
    // Ici on lance le workflow qui appelle le MCP
    traiterPiece(cabinetId, piece.id).catch((err) => {
      console.error(`Workflow échoué pour pièce ${piece.id}:`, err);
    });

    return NextResponse.json({ piece_id: piece.id, statut: "RECU" });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
