import { NextRequest, NextResponse } from "next/server";
import { getPiece } from "@/lib/queries";

// GET /api/pieces/[pieceId] — Détail d'une pièce
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pieceId: string }> },
) {
  try {
    const { pieceId } = await params;
    const { searchParams } = new URL(request.url);
    const cabinetId = searchParams.get("cabinet_id");

    if (!cabinetId) {
      return NextResponse.json({ error: "cabinet_id requis (query param)" }, { status: 400 });
    }

    const piece = await getPiece(cabinetId, pieceId);

    if (!piece) {
      return NextResponse.json({ error: "Pièce non trouvée" }, { status: 404 });
    }

    return NextResponse.json(piece);
  } catch (error) {
    console.error("GET /api/pieces/[pieceId] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
