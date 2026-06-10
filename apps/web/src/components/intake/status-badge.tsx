import { STATUT_LABELS, STATUT_COLORS } from "@/lib/types";
import type { PieceStatut } from "@/lib/types";

export function StatusBadge({ statut, warnings = 0 }: { statut: PieceStatut; warnings?: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
      background: `${STATUT_COLORS[statut]}20`, color: STATUT_COLORS[statut],
    }}>
      {STATUT_LABELS[statut]}
      {warnings > 0 && <span style={{ fontSize: 10, opacity: 0.8 }}>⚠{warnings}</span>}
    </span>
  );
}
