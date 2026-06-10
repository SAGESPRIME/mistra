import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import type { Piece, PieceStatut } from "@/lib/types";

interface PiecesResponse {
  pieces: Piece[];
  total: number;
  page: number;
  limite: number;
}

export function usePieces(filtre: PieceStatut | "tous", page: number = 1) {
  const params = new URLSearchParams();
  if (filtre !== "tous") params.set("statut", filtre);
  params.set("page", String(page));
  params.set("limite", "20");

  const { data, error, isLoading, mutate } = useSWR<PiecesResponse>(
    `/api/pieces?${params.toString()}`,
    (url: string) => apiFetch<PiecesResponse>(url),
    { refreshInterval: 5000 },
  );

  // Désactiver le polling si rien en traitement
  const hasTraitement = data?.pieces.some(p => p.statut === "TRAITEMENT" || p.statut === "RECU");

  return {
    pieces: data?.pieces ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    error: error?.message ?? null,
    refresh: mutate,
    hasTraitement: hasTraitement ?? false,
  };
}
