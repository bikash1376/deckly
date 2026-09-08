import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { X, Flag, Cards as CardsIcon } from "phosphor-react-native";
import { Flashcards as FlashcardsSchema, type ReviewGrade } from "@retenit/shared";

import { FlipCard } from "@/components/flip-card";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { useDeck, useReportCard } from "@/features/decks/hooks";
import { useGradeCard } from "@/features/review/hooks";
import { INITIAL_SRS, previewGrades } from "@/lib/srs";
import { shadow } from "@/theme";

/**
 * Height reserved for the action area.
 *
 * Two rows of 46pt buttons with an interval caption under each. Fixed rather
 * than measured, so revealing the answer does not resize the card above it and
 * make the text jump while it is being read.
 */
const ACTION_AREA_HEIGHT = 12 + 66 + 10 + 66;

const GRADES: { grade: ReviewGrade; label: string }[] = [
  { grade: "again", label: "Again" },
  { grade: "hard", label: "Hard" },
  { grade: "good", label: "Good" },
  { grade: "easy", label: "Easy" },
];

export default function FlashcardsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data } = useDeck(id);
  const grade = useGradeCard();
  const report = useReportCard();

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const cardRecord = useMemo(
    () => data?.cards.find((c) => c.kind === "flashcards"),
    [data?.cards],
  );

  const cards = useMemo(() => {
    if (!cardRecord) return [];
    const parsed = FlashcardsSchema.safeParse(cardRecord.content);
    return parsed.success ? parsed.data.cards : [];
  }, [cardRecord]);

  const current = cards[index];
  const intervals = previewGrades(INITIAL_SRS);

  const reveal = useCallback(() => {
    if (revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRevealed(true);
  }, [revealed]);

  const answer = useCallback(
    (value: ReviewGrade) => {
      if (cardRecord) {
        // Fire and forget. A dropped grade costs one review slot, and blocking
        // the next card on a round trip is far worse for a study session.
        grade.mutate({ cardId: cardRecord.id, cardIndex: index, grade: value });
      }
      if (index + 1 >= cards.length) {
        router.replace(`/deck/${id}`);
        return;
      }
      setRevealed(false);
      setIndex((i) => i + 1);
    },
    [cardRecord, grade, index, cards.length, router, id],
  );

  if (!current) {
    return (
      <View className="flex-1 justify-center" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={CardsIcon}
          title="No flashcards yet"
          body="Generate flashcards from the deck screen and they will show up here."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 px-gutter" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center gap-3">
        <IconButton
          icon={X}
          tone="sunken"
          size="sm"
          accessibilityLabel="End session"
          onPress={() => router.back()}
        />
        <Progress value={(index + 1) / cards.length} tone={data?.deck.color} className="flex-1" />
        <Text variant="label">
          {index + 1} of {cards.length}
        </Text>
      </View>

      <FlipCard
        flipped={revealed}
        onPress={reveal}
        accessibilityLabel={revealed ? "Answer shown" : "Tap to reveal the answer"}
        className="mt-7 min-h-0 flex-1"
        front={
          <View className="flex-1 justify-between p-6">
            <Chip label={data?.deck.subject ?? "Card"} tone={data?.deck.color ?? "neutral"} />
            <View>
              <Text variant="overline" className="mb-3">
                Question
              </Text>
              <Text variant="title">{current.front}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="caption">{current.hint ?? "Tap to flip"}</Text>
              <IconButton
                icon={Flag}
                tone="bare"
                size="sm"
                accessibilityLabel="Report this card"
                onPress={() =>
                  cardRecord && report.mutate({ cardId: cardRecord.id, reason: "user_flag" })
                }
              />
            </View>
          </View>
        }
        back={
          <View className="flex-1 justify-between p-6">
            <Chip label={data?.deck.subject ?? "Card"} tone={data?.deck.color ?? "neutral"} />
            <View>
              <Text variant="overline" className="mb-3">
                Answer
              </Text>
              <Text variant="title">{current.back}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="caption">How well did you know it?</Text>
              <IconButton
                icon={Flag}
                tone="bare"
                size="sm"
                accessibilityLabel="Report this card"
                onPress={() =>
                  cardRecord && report.mutate({ cardId: cardRecord.id, reason: "user_flag" })
                }
              />
            </View>
          </View>
        }
      />

      <View
        style={{ height: ACTION_AREA_HEIGHT, marginBottom: insets.bottom + 12 }}
        className="justify-end pt-4"
      >
        {revealed ? (
          <Animated.View entering={FadeIn.duration(180)} className="flex-row flex-wrap gap-2.5">
            {GRADES.map((item) => (
              <View key={item.grade} className="min-w-[46%] flex-1">
                <Button
                  label={item.label}
                  size="md"
                  variant={
                    item.grade === "again"
                      ? "destructive"
                      : item.grade === "easy"
                        ? "primary"
                        : "secondary"
                  }
                  onPress={() => answer(item.grade)}
                />
                <Text variant="caption" className="mt-1 text-center text-ink-faint">
                  {intervals[item.grade]}
                </Text>
              </View>
            ))}
          </Animated.View>
        ) : (
          <Button label="Show answer" onPress={reveal} />
        )}
      </View>
    </View>
  );
}
