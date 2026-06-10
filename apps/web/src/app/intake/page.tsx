"use client";

import { useState, useCallback } from "react";
import { UploadZone } from "@/components/intake/upload-zone";
import { PiecesTable } from "@/components/intake/pieces-table";
import { usePieces } from "@/hooks/use-pieces";
import type { PieceStatut } from "@/lib/types";

// TODO: remplacer par un select client réel
const CABINET_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "00000000-0000-0000-0000-000000000001";

export default function IntakePage() {
  const [filtre, setFiltre] = useState<PieceStatut | "tous">("tous");
  const [page, setPage] = useState(1);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const { pieces, total, loading, error, refresh } = usePieces(filtre, page);

  const handleUploaded = useCallback(() => {
    refresh();
  }, [refresh]);

  if (selectedPieceId) {
    // Affichage détail pièce (composant dynamique)
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <PieceDetailView
          pieceId={selectedPieceId}
          onBack={() => setSelectedPieceId(null)}
          onCorriger={async (corrections) => {
            await fetch(`/api/pieces/${selectedPieceId}/corriger`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cabinet_id: CABINET_ID, piece_id: selectedPieceId, corrections }),
            });
            refresh();
            setSelectedPieceId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Intake documentaire</h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Client : Boulangerie Dupont</span>
      </div>

      <UploadZone
        cabinetId={CABINET_ID}
        clientId={CLIENT_ID}
        onUploaded={handleUploaded}
      />

      {error && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 6, color: "#dc2626", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <PiecesTable
          pieces={pieces}
          total={total}
          page={page}
          filtre={filtre}
          loading={loading}
          onFiltreChange={setFiltre}
          onPageChange={setPage}
          onSelectPiece={setSelectedPieceId}
        />
      </div>
    </div>
  );
}

// Composant détail pièce
function PieceDetailView({ pieceId, onBack, onCorriger }: {
  pieceId: string;
  onBack: () => void;
  onCorriger: (corrections: Record<string, unknown>) => Promise<void>;
}) {
  const { usePiece: usePieceHook } = require("@/hooks/use-piece");
  const { piece, loading } = usePieceHook(pieceId);

  if (loading || !piece) {
    return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Chargement...</div>;
  }

  // On importe dynamiquement PieceDetail pour éviter le souci de SSR
  const { PieceDetail } = require("@/components/intake/piece-detail");
  return <PieceDetail piece={piece} onCorriger={onCorriger} onBack={onBack} />;
}
