import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ReviewQueue, type ReviewGrade } from "@retenit/shared";
import { useApi } from "@/lib/use-api";
import { deckKeys } from "@/features/decks/hooks";

export const reviewKeys = {
  all: ["review"] as const,
  queue: () => [...reviewKeys.all, "queue"] as const,
  due: () => [...reviewKeys.all, "due"] as const,
};

export function useReviewQueue() {
  const api = useApi();
  return useQuery({
    queryKey: reviewKeys.queue(),
    queryFn: ({ signal }) => api.get("/review/due", ReviewQueue, signal),
  });
}

/**
 * Just the count, for the dot on the Review tab. Separate from the full queue
 * so the tab bar does not pull down every due card on app launch.
 */
export function useDueCount() {
  const api = useApi();
  return useQuery({
    queryKey: reviewKeys.due(),
    queryFn: ({ signal }) =>
      api.get("/review/count", z.object({ count: z.number().int() }), signal),
    select: (data) => data.count,
    // Cards come due on a schedule, not on an event, so this is worth
    // refetching when the app returns to the foreground.
    staleTime: 5 * 60_000,
  });
}

/**
 * Grade a card. The server owns the SM-2 schedule; `src/lib/srs.ts` only
 * predicts the next interval so the UI can show it before the round trip.
 */
export function useGradeCard() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: { cardId: string; cardIndex?: number; grade: ReviewGrade }) =>
      api.post("/review/grade", input, z.object({ dueAt: z.string() })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.due() });
      qc.invalidateQueries({ queryKey: deckKeys.list() });
    },
  });
}
