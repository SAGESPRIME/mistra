import { RattacherInput } from "@mistra/shared";
import { getPieceById, rattacher as rattacherRepo, query } from "../db/index.js";
import { mcpSuccess, mcpError } from "@mistra/shared";
import { LIMITES } from "@mistra/shared";

export const rattacherTool = {
  name: "intake_rattacher",
  description: "Associe la pièce au bon dossier et à la bonne période",
  inputSchema: RattacherInput,

  execute: async (input: { cabinet_id: string; piece_id: string; dossier_id?: string; periode_id?: string }) => {
    const start = Date.now();

    const piece = await getPieceById(input.cabinet_id, input.piece_id);
    if (!piece) {
      return mcpError("intake_rattacher", "PIECE_INTROUVABLE", `Pièce ${input.piece_id} non trouvée`);
    }

    let dossierId = input.dossier_id;
    let periodeId = input.periode_id;
    let methode: "auto" | "manuel" = "manuel";

    // Auto-rattachement si dossier non fourni
    if (!dossierId && piece.date_piece && piece.client_id) {
      const result = await query(
        `SELECT id FROM dossiers
         WHERE client_id = $1 AND date_debut <= $2 AND date_fin >= $2
         LIMIT 1`,
        [piece.client_id, piece.date_piece],
      );
      if (result.rows[0]) {
        dossierId = result.rows[0].id;
        methode = "auto";
      }
    }

    if (!dossierId) {
      return mcpError("intake_rattacher", "RATTACHEMENT_IMPOSSIBLE", "Aucun dossier trouvé pour cette date/client");
    }

    // Vérifier que le dossier existe
    const dossierCheck = await query("SELECT id FROM dossiers WHERE id = $1", [dossierId]);
    if (dossierCheck.rowCount === 0) {
      return mcpError("intake_rattacher", "DOSSIER_INTROUVABLE", `Dossier ${dossierId} non trouvé`);
    }

    // Auto-rattachement période si non fournie
    if (!periodeId && piece.date_piece) {
      const mois = piece.date_piece.substring(0, 7); // "2025-03"
      const result = await query(
        `SELECT id FROM periodes WHERE dossier_id = $1 AND mois = $2 LIMIT 1`,
        [dossierId, mois],
      );
      if (result.rows[0]) {
        periodeId = result.rows[0].id;
        methode = "auto";
      }
    }

    if (input.dossier_id && input.periode_id) {
      methode = "manuel";
    }

    const updated = await rattacherRepo(input.cabinet_id, input.piece_id, dossierId, periodeId ?? "");

    const warnings = methode === "auto"
      ? [{ code: "RATTACHEMENT_AUTO", message: "Dossier/période déduits automatiquement" }]
      : undefined;

    const result = mcpSuccess("intake_rattacher", {
      piece_id: input.piece_id,
      dossier_id: dossierId,
      periode_id: periodeId ?? null,
      methode,
    }, warnings);
    result.metadata!.duration_ms = Date.now() - start;
    return result;
  },
};
