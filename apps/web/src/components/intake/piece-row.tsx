import type { Piece } from "@/lib/types";
import { TYPE_LABELS, formatMontant, formatDate } from "@/lib/types";
import { StatusBadge } from "./status-badge";

export function PieceRow({ piece, onClick }: { piece: Piece; onClick: (id: string) => void }) {
  return (
    <tr
      onClick={() => onClick(piece.id)}
      style={{ cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
    >
      <td style={{ padding: "8px 12px", fontSize: 13 }}>{piece.fichier_nom}</td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>
        {piece.type_document ? TYPE_LABELS[piece.type_document] : "—"}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>{piece.tiers_nom ?? "—"}</td>
      <td style={{ padding: "8px 12px", fontSize: 13, textAlign: "right" }}>
        {formatMontant(piece.montant_ttc)}
      </td>
      <td style={{ padding: "8px 12px", fontSize: 13 }}>{formatDate(piece.date_piece)}</td>
      <td style={{ padding: "8px 12px" }}>
        <StatusBadge statut={piece.statut} warnings={piece.warnings?.length} />
      </td>
    </tr>
  );
}
