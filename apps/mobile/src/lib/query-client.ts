import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Generated cards never change once written, so refetching them on every
      // focus would spend the user's data redrawing identical text.
      staleTime: 60_000,
      // A day, because that is how long a cached deck stays worth showing to
      // someone opening the app on a train with no signal.
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Persist the query cache so decks and notes are readable offline.
 *
 * Only queries are persisted, never mutations. A replayed mutation would mean
 * a generation the user did not ask for, charged again, which is a far worse
 * failure than losing an unsent request.
 */
export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "retenit.query-cache.v1",
  throttleTime: 2_000,
});

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  /**
   * Bumping this discards the whole cache. Change it whenever a wire shape
   * changes, so a cached response from an older build cannot fail its schema
   * parse and leave a screen permanently broken.
   */
  buster: "v1",
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string }; queryKey: readonly unknown[] }) => {
      if (query.state.status !== "success") return false;
      // The credit balance must never be read from disk. A stale one would grey
      // out a button the user can actually afford, or worse, the reverse.
      return query.queryKey[0] !== "me";
    },
  },
};
