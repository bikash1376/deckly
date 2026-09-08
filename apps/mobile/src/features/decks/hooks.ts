import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Deck,
  DeckDetail,
  Card,
  UploadTarget,
  type CardKind,
  type CreateDeckInput,
} from "@deckly/shared";
import { useApi } from "@/lib/use-api";

export const deckKeys = {
  all: ["decks"] as const,
  list: () => [...deckKeys.all, "list"] as const,
  detail: (id: string) => [...deckKeys.all, "detail", id] as const,
};

export function useDecks() {
  const api = useApi();
  return useQuery({
    queryKey: deckKeys.list(),
    queryFn: ({ signal }) => api.get("/decks", z.array(Deck), signal),
  });
}

export function useDeck(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: deckKeys.detail(id),
    queryFn: ({ signal }) => api.get(`/decks/${id}`, DeckDetail, signal),
    enabled: !!id,
  });
}

export function useCreateDeck() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDeckInput) => api.post("/decks", input, Deck),
    onSuccess: (deck) => {
      // Seed the detail cache so the deck screen has content before its own
      // fetch resolves, which removes a skeleton flash on the most common
      // transition in the app.
      qc.setQueryData(deckKeys.detail(deck.id), {
        deck,
        cards: [],
        outline: [],
      });
      qc.invalidateQueries({ queryKey: deckKeys.list() });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/**
 * Generate one card kind on demand. This is the lazy half of the generation
 * strategy: the deck arrives with a seed, everything else is bought a card at
 * a time.
 */
export function useGenerateCard(deckId: string) {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (kind: Exclude<CardKind, "seed">) =>
      api.post(`/decks/${deckId}/cards`, { kind }, Card),
    onSuccess: (card) => {
      qc.setQueryData(deckKeys.detail(deckId), (previous: unknown) => {
        if (!previous) return previous;
        const detail = previous as { cards: unknown[] };
        return { ...detail, cards: [...detail.cards, card] };
      });
      // Credits changed, so the meter and any gated buttons need to know.
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useDeleteDeck() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.del(`/decks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.all }),
  });
}

/** Signed PUT straight to R2, so a 20MB PDF never travels through the Worker. */
export function useUploadTarget() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: { fileName: string; contentType: string; size: number }) =>
      api.post("/uploads/sign", input, UploadTarget),
  });
}

/** Flag a generated card. Required for a Play Store GenAI listing. */
export function useReportCard() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: { cardId: string; reason: string }) => api.post("/report", input),
  });
}
