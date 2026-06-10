import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import type { Piece } from "@/lib/types";

export function usePiece(pieceId: string | null, cabinetId?: string) {
  const { data, error, isLoading, mutate } = useSWR<Piece>(
    pieceId ? `/api/pieces/${pieceId}?cabinet_id=${cabinetId ?? "00000000-0000-0000-0000-000000000001"}` : null,
    (url: string) => apiFetch<Piece>(url),
  );

  return {
    piece: data ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    refresh: mutate,
  };
}
