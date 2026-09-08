import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  FireIcon as Fire,
  MagnifyingGlassIcon as MagnifyingGlass,
  PlusIcon as Plus,
  CardsIcon as Cards,
} from "phosphor-react-native";
import type { Deck } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { IconButton } from "@/components/ui/icon-button";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm";
import { DeckCard } from "@/components/deck-card";
import { useDecks, useDeleteDeck } from "@/features/decks/hooks";
import { useMe } from "@/features/me/hooks";
import { raw, shadow } from "@/theme";

type Filter = "all" | "active" | "done";

const FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "active" as const, label: "In progress" },
  { value: "done" as const, label: "Done" },
];

export default function DecksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: decks, isLoading, isError, refetch, isRefetching } = useDecks();
  const { data: me } = useMe();
  const deleteDeck = useDeleteDeck();
  const ask = useConfirm();

  /**
   * Long press rather than swipe. A two column grid has nowhere for a row to
   * slide, and the confirmation matters more than the gesture: deleting a deck
   * takes its cards and their whole review history with it.
   */
  const confirmDelete = useCallback(
    async (id: string, title: string) => {
      const ok = await ask({
        title: `Delete "${title}"?`,
        body: "Its cards and everything you have reviewed in it go too. This cannot be undone.",
        destructive: true,
      });
      if (ok) deleteDeck.mutate(id);
    },
    [ask, deleteDeck],
  );

  const visible = useMemo(() => {
    if (!decks) return [];
    if (filter === "active") {
      return decks.filter((d) => d.cardsDone > 0 && d.cardsDone < d.cardsTotal);
    }
    if (filter === "done") {
      return decks.filter((d) => d.cardsTotal > 0 && d.cardsDone >= d.cardsTotal);
    }
    return decks;
  }, [decks, filter]);

  const header = (
    <View>
      <View className="mb-5 flex-row items-center justify-between">
        {me && me.streak > 0 ? (
          <View
            style={shadow.card}
            className="h-11 flex-row items-center gap-2 rounded-pill bg-surface px-4"
          >
            <Fire size={18} color={raw.amber} weight="fill" />
            <Text variant="subheading">
              {me.streak === 1 ? "1 day streak" : `${me.streak} day streak`}
            </Text>
          </View>
        ) : (
          <View />
        )}
        <IconButton
          icon={MagnifyingGlass}
          accessibilityLabel="Search decks"
          onPress={() => router.push("/search")}
        />
      </View>

      <Text variant="display">Your decks</Text>

      <Segmented
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        className="mt-4"
      />
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 px-gutter" style={{ paddingTop: insets.top + 8 }}>
        {header}
        <View className="mt-6 flex-row flex-wrap gap-x-3.5 gap-y-[18px]">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-1 min-w-[45%] gap-3">
              <Skeleton className="aspect-[1/0.93] rounded-tile" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlatList
        data={visible}
        keyExtractor={(item: Deck) => item.id}
        numColumns={2}
        columnWrapperClassName="gap-3.5"
        contentContainerClassName="px-gutter gap-[18px]"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          // Clear the floating tab bar plus its own bottom padding.
          paddingBottom: insets.bottom + 120,
        }}
        ListHeaderComponent={header}
        ListHeaderComponentClassName="mb-1"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={raw.inkMuted} />
        }
        renderItem={({ item }) => (
          <View className="flex-1">
            <DeckCard
              id={item.id}
              title={item.title}
              color={item.color}
              done={item.cardsDone}
              total={item.cardsTotal}
              onPress={() => router.push(`/deck/${item.id}`)}
              onLongPress={() => confirmDelete(item.id, item.title)}
            />
          </View>
        )}
        ListEmptyComponent={
          isError ? (
            <EmptyState
              icon={Cards}
              title="Could not load your decks"
              body="Check your connection and pull down to try again."
            />
          ) : filter === "all" ? (
            <EmptyState
              icon={Cards}
              title="Make your first deck"
              body="Start with a topic, paste your notes, or drop in a PDF. You get a summary, flashcards and a quiz."
              actionLabel="New deck"
              onAction={() => router.push("/create")}
            />
          ) : (
            <EmptyState
              icon={Cards}
              title="Nothing here yet"
              body={
                filter === "active"
                  ? "Decks you have started but not finished will show up here."
                  : "Decks where you have reviewed every card will show up here."
              }
            />
          )
        }
      />

      {/* Sits above the tab bar rather than inside it: creating a deck is the
          one action that should be reachable from anywhere on this screen. */}
      <View
        className="absolute right-gutter"
        style={{ bottom: insets.bottom + 96 }}
        pointerEvents="box-none"
      >
        <IconButton
          icon={Plus}
          tone="ink"
          size="lg"
          accessibilityLabel="New deck"
          onPress={() => router.push("/create")}
        />
      </View>
    </View>
  );
}
