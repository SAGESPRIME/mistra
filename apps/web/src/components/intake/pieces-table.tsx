"use client";

import type { Piece, PieceStatut } from "@/lib/types";
import { PieceRow } from "./piece-row";

interface PiecesTableProps {
  pieces: Piece[];
  total: number;
  page: number;
  filtre: PieceStatut | "tous";
  loading: boolean;
  onFiltreChange: (f: PieceStatut | "tous") => void;
  onPageChange: (p: number) => void;
  onSelectPiece: (id: string) => void;
}

const FILTRES: Array<{ value: PieceStatut | "tous"; label: string }> = [
  { value: "tous", label: "Tous" },
  { value: "TRAITEMENT", label: "En traitement" },
  { value: "PRET", label: "Prêts" },
  { value: "ANOMALIE", label: "Anomalies" },
];

export function PiecesTable({
  pieces, total, page, filtre, loading,
  onFiltreChange, onPageChange, onSelectPiece,
}: PiecesTableProps) {
  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {FILTRES.map(f => (
          <button
            key={f.value}
            onClick={() => onFiltreChange(f.value)}
            style={{
              padding: "4px 12px", borderRadius: 6, fontSize: 13,
              border: filtre === f.value ? "1px solid #3b82f6" : "1px solid #e5e7eb",
              background: filtre === f.value ? "#eff6ff" : "#fff",
              color: filtre === f.value ? "#3b82f6" : "#6b7280",
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tableau */}
      {loading && pieces.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
          Chargement...
        </div>
      ) : pieces.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
          Aucune pièce. Glissez vos fichiers ci-dessus pour commencer.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
              <th style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>Fichier</th>
              <th style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>Type</th>
              <th style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>Tiers</th>
              <th style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280", textAlign: "right" }}>Montant</th>
              <th style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>Date</th>
              <th style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map(p => (
              <PieceRow key={p.id} piece={p} onClick={onSelectPiece} />
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 13, color: "#6b7280" }}>
          <span>{total} pièces</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>
              Précédent
            </button>
            <span style={{ padding: "4px 8px" }}>Page {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
