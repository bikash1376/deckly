import { useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, MagnifyingGlass } from "phosphor-react-native";
import type { Deck, Note } from "@deckly/shared";

import { Text } from "@/components/ui/text";
import { PressableCard } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState } from "@/components/ui/empty-state";
import { useDecks } from "@/features/decks/hooks";
import { useNotes } from "@/features/notes/hooks";
import { raw, shadow } from "@/theme";

type Hit =
  | { type: "deck"; id: string; title: string; subtitle: string; deck: Deck }
  | { type: "note"; id: string; title: string; subtitle: string };

/**
 * Local search over what is already cached.
 *
 * A server search endpoint would be better at scale, but a student with forty
 * decks and twenty notes is the realistic ceiling for a long while, and
 * filtering in memory is instant and works offline.
 */
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { data: decks } = useDecks();
  const { data: notes } = useNotes();

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const deckHits: Hit[] = (decks ?? [])
      .filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.subject.toLowerCase().includes(q) ||
          d.tldr.toLowerCase().includes(q),
      )
      .map((d) => ({
        type: "deck",
        id: d.id,
        title: d.title,
        subtitle: d.subject,
        deck: d,
      }));

    const noteHits: Hit[] = (notes ?? [])
      .filter(
        (n: Note) =>
          n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
      )
      .map((n) => ({
        type: "note",
        id: n.id,
        title: n.title || "Untitled note",
        subtitle: "Note",
      }));

    return [...deckHits, ...noteHits];
  }, [query, decks, notes]);

  return (
    <View className="flex-1" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center gap-2.5 px-gutter">
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />
        <View
          style={shadow.card}
          className="h-11 flex-1 flex-row items-center gap-2.5 rounded-pill bg-surface px-4"
        >
          <MagnifyingGlass size={18} color={raw.inkFaint} weight="regular" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Search decks and notes"
            placeholderTextColor={raw.inkFaint}
            selectionColor={raw.clay}
            returnKeyType="search"
            className="flex-1 font-body text-body text-ink"
          />
        </View>
      </View>

      <FlatList
        data={hits}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerClassName="px-gutter pt-5 gap-2.5"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PressableCard
            onPress={() =>
              router.push(item.type === "deck" ? `/deck/${item.id}` : `/note/${item.id}`)
            }
            accessibilityLabel={item.title}
            className="flex-row items-center justify-between p-4"
          >
            <View className="flex-1">
              <Text variant="heading" numberOfLines={1}>
                {item.title}
              </Text>
              <Text variant="caption">{item.subtitle}</Text>
            </View>
            {item.type === "deck" ? (
              <Chip label={item.deck.subject} tone={item.deck.color} />
            ) : null}
          </PressableCard>
        )}
        ListEmptyComponent={
          query.trim().length < 2 ? (
            <EmptyState
              icon={MagnifyingGlass}
              title="Find anything"
              body="Search across your deck titles, summaries and note text."
            />
          ) : (
            <EmptyState
              icon={MagnifyingGlass}
              title="Nothing matched"
              body={`No decks or notes contain "${query.trim()}". Try a shorter word.`}
            />
          )
        }
      />
    </View>
  );
}
