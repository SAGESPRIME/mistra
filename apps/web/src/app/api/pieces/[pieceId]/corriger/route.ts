import { NextRequest, NextResponse } from "next/server";
import { lancerWorkflowRecontrole } from "@/lib/mastra-client";

// PATCH /api/pieces/[pieceId]/corriger — Corriger une anomalie et recontrôler.
// Toute la logique (validation des champs, mise à jour, règles de contrôle)
// vit dans le workflow Mastra "recontrole" et le tool intake_controler.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> },
) {
  try {
    const { pieceId } = await params;
    const body = await request.json();

    if (!body.cabinet_id || !body.corrections || Object.keys(body.corrections).length === 0) {
      return NextResponse.json({ error: "cabinet_id et corrections requis" }, { status: 400 });
    }

    const resultat = await lancerWorkflowRecontrole({
      cabinet_id: body.cabinet_id,
      piece_id: pieceId,
      corrections: body.corrections,
    });

    return NextResponse.json({
      piece_id: resultat.piece_id,
      champs_corriges: resultat.champs_corriges,
      statut: resultat.statut,
      controle_code: resultat.controle_code,
      controles: resultat.controles,
    });
  } catch (error) {
    console.error("PATCH /api/pieces/[pieceId]/corriger error:", error);
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
