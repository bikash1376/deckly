import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Note, Deck } from "@retenit/shared";
import { useApi } from "@/lib/use-api";
import { deckKeys } from "@/features/decks/hooks";

export const noteKeys = {
  all: ["notes"] as const,
  list: () => [...noteKeys.all, "list"] as const,
  detail: (id: string) => [...noteKeys.all, "detail", id] as const,
};

export function useNotes() {
  const api = useApi();
  return useQuery({
    queryKey: noteKeys.list(),
    queryFn: ({ signal }) => api.get("/notes", z.array(Note), signal),
  });
}

export function useNote(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: noteKeys.detail(id),
    queryFn: ({ signal }) => api.get(`/notes/${id}`, Note, signal),
    enabled: !!id && id !== "new",
  });
}

export function useCreateNote() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string }) => api.post("/notes", input, Note),
    onSuccess: (note) => {
      qc.setQueryData(noteKeys.detail(note.id), note);
      qc.invalidateQueries({ queryKey: noteKeys.list() });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useSaveNote(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; body?: string }) =>
      api.patch(`/notes/${id}`, input, Note),
    onSuccess: (note) => {
      qc.setQueryData(noteKeys.detail(id), note);
      // The list only shows title and timestamp, so it is cheap to refresh and
      // wrong to leave stale after a rename.
      qc.invalidateQueries({ queryKey: noteKeys.list() });
    },
  });
}

export function useDeleteNote() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/notes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
  });
}

/** The bridge between the two halves of the app. */
export function useNoteToDeck() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => api.post(`/notes/${noteId}/deck`, undefined, Deck),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deckKeys.list() });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
