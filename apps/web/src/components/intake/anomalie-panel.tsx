"use client";

import { useState } from "react";
import type { Piece } from "@/lib/types";
import { Button } from "../ui/button";

interface AnomaliePanelProps {
  piece: Piece;
  onCorriger: (corrections: Record<string, unknown>) => Promise<void>;
}

export function AnomaliePanel({ piece, onCorriger }: AnomaliePanelProps) {
  const [tiersNom, setTiersNom] = useState(piece.tiers_nom ?? "");
  const [numeroPiece, setNumeroPiece] = useState(piece.numero_piece ?? "");
  const [montantTtc, setMontantTtc] = useState(
    piece.montant_ttc !== null ? (piece.montant_ttc / 100).toFixed(2) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const corrections: Record<string, unknown> = {};
    if (tiersNom && tiersNom !== piece.tiers_nom) corrections.tiers_nom = tiersNom;
    if (numeroPiece && numeroPiece !== piece.numero_piece) corrections.numero_piece = numeroPiece;
    if (montantTtc) {
      const centimes = Math.round(parseFloat(montantTtc) * 100);
      if (centimes !== piece.montant_ttc) corrections.montant_ttc = centimes;
    }

    try {
      await onCorriger(corrections);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "grid", gap: 8, maxWidth: 400 }}>
        <div>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Tiers</label>
          <input
            value={tiersNom}
            onChange={e => setTiersNom(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b7280" }}>N° pièce</label>
          <input
            value={numeroPiece}
            onChange={e => setNumeroPiece(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Montant TTC (€)</label>
          <input
            type="number"
            step="0.01"
            value={montantTtc}
            onChange={e => setMontantTtc(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 13 }}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Correction en cours..." : "Corriger et recontrôler"}
        </Button>
      </div>
    </form>
  );
}
