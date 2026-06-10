import { NextRequest, NextResponse } from "next/server";
import { corrigerPiece, controlerPiece } from "@/lib/db";

// PATCH /api/pieces/[pieceId]/corriger — Corriger une anomalie et recontrôler
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

    // Corriger la pièce
    const piece = await corrigerPiece(body.cabinet_id, pieceId, body.corrections);

    if (!piece) {
      return NextResponse.json({ error: "Pièce non trouvée ou pas en anomalie" }, { status: 404 });
    }

    // Recontrôler immédiatement
    const controle = await controlerPiece(body.cabinet_id, pieceId);

    return NextResponse.json({
      piece_id: pieceId,
      champs_corriges: Object.keys(body.corrections),
      statut: controle.statut,
      controles: controle.controles,
    });
  } catch (error) {
    console.error("PATCH /api/pieces/[pieceId]/corriger error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
