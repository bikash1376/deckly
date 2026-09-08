import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import {
  ArrowLeftIcon as ArrowLeft,
  PlusIcon as Plus,
  TrashIcon as Trash,
} from "phosphor-react-native";
import { Flashcards as FlashcardsSchema } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { useDeck, useSaveFlashcards } from "@/features/decks/hooks";
import { raw } from "@/theme";

interface Draft {
  /** Local only, so a row keeps its identity while being typed into. */
  key: string;
  front: string;
  back: string;
  hint: string;
}

const blank = (): Draft => ({ key: `${Date.now()}-${Math.random()}`, front: "", back: "", hint: "" });

/**
 * Write flashcards by hand.
 *
 * Costs nothing. Generation is the paid product; owning a deck is not, and
 * somebody out of credits at 11pm should still be able to type in the ten cards
 * they need for tomorrow.
 */
export default function EditFlashcardsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data } = useDeck(id);
  const save = useSaveFlashcards(id);

  const [drafts, setDrafts] = useState<Draft[]>([blank()]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || !data) return;
    const existing = data.cards.find((c) => c.kind === "flashcards");
    if (existing) {
      const parsed = FlashcardsSchema.safeParse(existing.content);
      if (parsed.success && parsed.data.cards.length > 0) {
        setDrafts(
          parsed.data.cards.map((card, i) => ({
            key: `existing-${i}`,
            front: card.front,
            back: card.back,
            hint: card.hint ?? "",
          })),
        );
      }
    }
    setHydrated(true);
  }, [data, hydrated]);

  const update = useCallback((key: string, field: keyof Omit<Draft, "key">, value: string) => {
    setDrafts((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }, []);

  const remove = useCallback((key: string) => {
    setDrafts((rows) => (rows.length === 1 ? [blank()] : rows.filter((r) => r.key !== key)));
  }, []);

  const submit = useCallback(async () => {
    const cards = drafts
      .map((d) => ({
        front: d.front.trim(),
        back: d.back.trim(),
        hint: d.hint.trim() || null,
      }))
      .filter((c) => c.front && c.back);

    if (cards.length === 0) {
      setError("Fill in at least one card with both a question and an answer.");
      return;
    }

    setError(null);
    try {
      await save.mutateAsync(cards);
      router.back();
    } catch {
      setError("Could not save. Check your connection and try again.");
    }
  }, [drafts, save, router]);

  const ready = drafts.filter((d) => d.front.trim() && d.back.trim()).length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <View
        className="flex-row items-center justify-between px-gutter pb-2"
        style={{ paddingTop: insets.top + 12 }}
      >
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />
        <Text variant="caption">
          {ready === 1 ? "1 card ready" : `${ready} cards ready`}
        </Text>
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pb-8 pt-2 gap-2.5"
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title" className="mb-2">
          {data?.deck.title ?? "Flashcards"}
        </Text>

        {drafts.map((draft, index) => (
          <Animated.View
            key={draft.key}
            layout={LinearTransition.springify().damping(20)}
            entering={FadeIn.duration(160)}
          >
            <Card className="p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text variant="overline">Card {index + 1}</Text>
                <IconButton
                  icon={Trash}
                  tone="bare"
                  size="sm"
                  accessibilityLabel={`Delete card ${index + 1}`}
                  onPress={() => remove(draft.key)}
                />
              </View>

              <TextInput
                value={draft.front}
                onChangeText={(v) => update(draft.key, "front", v)}
                placeholder="Question"
                placeholderTextColor={raw.inkFaint}
                selectionColor={raw.clay}
                multiline
                className="font-body-sb text-subheading text-ink"
              />
              <View className="my-3 h-px bg-hairline" />
              <TextInput
                value={draft.back}
                onChangeText={(v) => update(draft.key, "back", v)}
                placeholder="Answer"
                placeholderTextColor={raw.inkFaint}
                selectionColor={raw.clay}
                multiline
                className="font-body text-body text-ink"
              />
              <TextInput
                value={draft.hint}
                onChangeText={(v) => update(draft.key, "hint", v)}
                placeholder="Hint, optional"
                placeholderTextColor={raw.inkFaint}
                selectionColor={raw.clay}
                className="mt-2 font-body text-caption text-ink-muted"
              />
            </Card>
          </Animated.View>
        ))}

        <Button
          label="Add another card"
          variant="secondary"
          size="md"
          icon={Plus}
          onPress={() => setDrafts((rows) => [...rows, blank()])}
        />

        {error ? (
          <Text variant="caption" className="text-danger">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View className="px-gutter" style={{ paddingBottom: insets.bottom + 20 }}>
        <Text variant="caption" className="mb-2 text-center">
          Editing a question keeps its review history. New ones start fresh.
        </Text>
        <Button label="Save cards" loading={save.isPending} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}
