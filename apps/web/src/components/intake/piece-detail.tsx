"use client";

import type { Piece } from "@/lib/types";
import { TYPE_LABELS, STATUT_LABELS, formatMontant, formatDate } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { Card } from "../ui/card";
import { AnomaliePanel } from "./anomalie-panel";

interface PieceDetailProps {
  piece: Piece;
  onCorriger: (corrections: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

export function PieceDetail({ piece, onCorriger, onBack }: PieceDetailProps) {
  return (
    <div>
      <button onClick={onBack} style={{ border: "none", background: "none", color: "#3b82f6", cursor: "pointer", fontSize: 14, marginBottom: 16 }}>
        ← Retour à la liste
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{piece.fichier_nom}</h2>
        <StatusBadge statut={piece.statut} warnings={piece.warnings?.length} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ fontSize: 14, color: "#6b7280", marginTop: 0 }}>Informations</h3>
          <Ligne label="Type" value={piece.type_document ? TYPE_LABELS[piece.type_document] : "—"} />
          <Ligne label="Date" value={formatDate(piece.date_piece)} />
          <Ligne label="Échéance" value={formatDate(piece.date_echeance)} />
          <Ligne label="Tiers" value={piece.tiers_nom ?? "—"} />
          <Ligne label="SIRET" value={piece.tiers_siret ?? "—"} />
          <Ligne label="N° pièce" value={piece.numero_piece ?? "—"} />
          <Ligne label="Description" value={piece.description ?? "—"} />
        </Card>

        <Card>
          <h3 style={{ fontSize: 14, color: "#6b7280", marginTop: 0 }}>Montants</h3>
          <Ligne label="Montant HT" value={formatMontant(piece.montant_ht)} />
          <Ligne label="TVA" value={formatMontant(piece.montant_tva)} />
          <Ligne label="Montant TTC" value={formatMontant(piece.montant_ttc)} />
          <Ligne label="Taux TVA" value={piece.taux_tva ? `${piece.taux_tva / 100}%` : "—"} />
          <Ligne label="Confiance OCR" value={piece.ocr_confidence ? `${(piece.ocr_confidence * 100).toFixed(0)}%` : "—"} />
        </Card>
      </div>

      {/* Warnings */}
      {piece.warnings && piece.warnings.length > 0 && (
        <Card style={{ marginTop: 16, borderColor: "#fbbf24" }}>
          <h3 style={{ fontSize: 14, color: "#d97706", marginTop: 0 }}>Warnings</h3>
          {piece.warnings.map((w, i) => (
            <p key={i} style={{ fontSize: 13, color: "#92400e", margin: "4px 0" }}>⚠ {w.message}</p>
          ))}
        </Card>
      )}

      {/* Anomalie */}
      {piece.statut === "ANOMALIE" && (
        <Card style={{ marginTop: 16, borderColor: "#ef4444" }}>
          <h3 style={{ fontSize: 14, color: "#dc2626", marginTop: 0 }}>
            Anomalie : {piece.controle_message ?? "Erreur détectée"}
          </h3>
          <AnomaliePanel piece={piece} onCorriger={onCorriger} />
        </Card>
      )}
    </div>
  );
}

function Ligne({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
