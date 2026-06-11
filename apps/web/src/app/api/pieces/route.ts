import { NextRequest, NextResponse } from "next/server";
import { searchPieces } from "@/lib/queries";
import { lancerWorkflowIntake } from "@/lib/mastra-client";

// GET /api/pieces — Liste les pièces avec filtres
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cabinetId = searchParams.get("cabinet_id") ?? "";
    const clientId = searchParams.get("client_id") ?? undefined;
    const statut = searchParams.get("statut") ?? undefined;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limite = Math.min(parseInt(searchParams.get("limite") ?? "20", 10), 100);

    if (!cabinetId) {
      return NextResponse.json({ error: "cabinet_id requis" }, { status: 400 });
    }

    const result = await searchPieces({
      cabinet_id: cabinetId,
      client_id: clientId,
      statut,
      page,
      limite,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/pieces error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/pieces — Lance le workflow intake sur un fichier déjà accessible par URL
// (la création de la pièce est faite par le workflow lui-même — step recevoir-fichier)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.cabinet_id || !body.client_id || !body.fichier_url || !body.fichier_nom || !body.fichier_type) {
      return NextResponse.json({ error: "Champs manquants: cabinet_id, client_id, fichier_url, fichier_nom, fichier_type" }, { status: 400 });
    }

    const resultat = await lancerWorkflowIntake({
      cabinet_id: body.cabinet_id,
      client_id: body.client_id,
      fichier_url: body.fichier_url,
      fichier_nom: body.fichier_nom,
      fichier_type: body.fichier_type,
      source: body.source ?? "upload",
    });

    return NextResponse.json({ piece_id: resultat.piece_id, statut: resultat.statut });
  } catch (error) {
    console.error("POST /api/pieces error:", error);
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
