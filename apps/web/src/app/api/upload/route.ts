import { NextRequest, NextResponse } from "next/server";
import { enregistrerFichier } from "@/lib/fichiers";
import { lancerWorkflowIntake } from "@/lib/mastra-client";

// POST /api/upload — Reçoit un fichier, le stocke, et délègue TOUT le traitement
// au workflow Mastra "intake" (OCR → classification → extraction → rattachement → contrôle).
// Cette route ne contient que de la validation d'entrée — aucune logique métier.

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

    // Stocker le fichier sur disque — il sera servi au serveur MCP via /api/fichiers/...
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await enregistrerFichier(buffer, fichierType);

    // Lancer le workflow Mastra et attendre son verdict.
    // L'état du run est persisté côté Mastra : pas de pièce bloquée en cas de crash.
    const resultat = await lancerWorkflowIntake({
      cabinet_id: cabinetId,
      client_id: clientId,
      fichier_url: url,
      fichier_nom: file.name,
      fichier_type: fichierType,
      source: "upload",
    });

    return NextResponse.json({
      piece_id: resultat.piece_id,
      statut: resultat.statut,
      controle_code: resultat.controle_code,
      erreurs_count: resultat.erreurs_count,
      warnings_count: resultat.warnings_count,
    });
  } catch (error) {
    console.error("[upload] Erreur:", error);
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
