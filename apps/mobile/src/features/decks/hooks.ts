import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Deck,
  DeckDetail,
  Card,
  WeakTopic,
  type CardKind,
  type CreateDeckInput,
  type CreateManualDeckInput,
  type Flashcards,
  type Quiz,
} from "@retenit/shared";
import { useApi } from "@/lib/use-api";

export const deckKeys = {
  all: ["decks"] as const,
  list: () => [...deckKeys.all, "list"] as const,
  detail: (id: string) => [...deckKeys.all, "detail", id] as const,
  weakTopics: (id: string) => [...deckKeys.all, "weak", id] as const,
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

/**
 * Send a PDF as the request body and get a deck back.
 *
 * One request, no upload step. The Worker reads the text and discards the
 * bytes, so nothing of the original document is kept anywhere.
 */
export function useCreateDeckFromPdf() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { uri: string; fileName: string }) => {
      const blob = await (await fetch(input.uri)).blob();
      return api.postBinary("/decks/pdf", blob, "application/pdf", Deck, {
        "X-File-Name": input.fileName,
      });
    },
    onSuccess: (deck) => {
      qc.setQueryData(deckKeys.detail(deck.id), { deck, cards: [], outline: [] });
      qc.invalidateQueries({ queryKey: deckKeys.list() });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

/**
 * Concepts this deck keeps catching the user out on, worst first.
 *
 * Read from every attempt on the server rather than the last quiz in local
 * state: a concept missed once is noise, the same one missed three times over
 * a fortnight is the thing to revise.
 */
export function useWeakTopics(deckId: string) {
  const api = useApi();
  return useQuery({
    queryKey: deckKeys.weakTopics(deckId),
    queryFn: ({ signal }) =>
      api.get(`/decks/${deckId}/weak-topics`, z.array(WeakTopic), signal),
    enabled: !!deckId,
  });
}

/** Submitted as one batch when a quiz finishes, not per answer. */
export function useRecordAttempts(deckId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attempts: { concept: string; correct: boolean }[]) =>
      api.post(`/decks/${deckId}/attempts`, { attempts }),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.weakTopics(deckId) }),
  });
}

/**
 * Build a deck by hand, with no model involved.
 *
 * Free, always. Generation is the paid product; owning a deck is not. Someone
 * out of credits should still be able to type in the ten cards they need
 * tonight, and someone who does not trust AI output for their subject should be
 * able to use the app at all.
 */
export function useCreateManualDeck() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateManualDeckInput) => api.post("/decks/manual", input, Deck),
    onSuccess: (deck) => {
      qc.setQueryData(deckKeys.detail(deck.id), { deck, cards: [], outline: [] });
      qc.invalidateQueries({ queryKey: deckKeys.list() });
    },
  });
}

/**
 * Replace a deck's flashcards.
 *
 * The server carries scheduling state across by matching card fronts, so
 * editing a wording keeps its review history while a genuinely new card starts
 * fresh.
 */
export function useSaveFlashcards(deckId: string) {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (cards: Flashcards["cards"]) =>
      api.put(`/decks/${deckId}/flashcards`, { cards }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deckKeys.detail(deckId) });
      qc.invalidateQueries({ queryKey: deckKeys.list() });
      qc.invalidateQueries({ queryKey: ["review"] });
    },
  });
}

export function useSaveQuiz(deckId: string) {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (questions: Quiz["questions"]) =>
      api.put(`/decks/${deckId}/quiz`, { questions }),
    onSuccess: () => qc.invalidateQueries({ queryKey: deckKeys.detail(deckId) }),
  });
}

/** Flag a generated card. Required for a Play Store GenAI listing. */
export function useReportCard() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: { cardId: string; reason: string }) => api.post("/report", input),
  });
}
