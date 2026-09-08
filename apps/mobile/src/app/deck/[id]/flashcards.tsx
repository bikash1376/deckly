import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  XIcon as X,
  FlagIcon as Flag,
  CardsIcon,
} from "phosphor-react-native";
import { Flashcards as FlashcardsSchema, type ReviewGrade } from "@retenit/shared";

import { FlipCard } from "@/components/flip-card";
import { GradeSheet } from "@/features/review/grade-sheet";
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
/** One row of 46pt buttons with a caption beneath, plus the space above. */
const ACTION_AREA_HEIGHT = 12 + 66;

export default function FlashcardsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data } = useDeck(id);
  const grade = useGradeCard();
  const report = useReportCard();

  /**
   * Positions still to get right, in order, plus how many are done.
   *
   * "Again" means the card was not known, so it goes to the back of the queue
   * rather than counting as progress. Advancing on Again made the bar fill up
   * while you were failing, which is both wrong and quietly discouraging.
   */
  const [queue, setQueue] = useState<number[]>([]);
  const [completed, setCompleted] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [gradesOpen, setGradesOpen] = useState(false);

  const cardRecord = useMemo(
    () => data?.cards.find((c) => c.kind === "flashcards"),
    [data?.cards],
  );

  const cards = useMemo(() => {
    if (!cardRecord) return [];
    const parsed = FlashcardsSchema.safeParse(cardRecord.content);
    return parsed.success ? parsed.data.cards : [];
  }, [cardRecord]);

  useEffect(() => {
    if (cards.length > 0 && queue.length === 0 && completed === 0) {
      setQueue(cards.map((_, i) => i));
    }
  }, [cards, queue.length, completed]);

  const position = queue[0];
  const current = position === undefined ? undefined : cards[position];
  const intervals = previewGrades(INITIAL_SRS);

  const reveal = useCallback(() => {
    if (revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRevealed(true);
  }, [revealed]);

  const answer = useCallback(
    (value: ReviewGrade) => {
      if (position === undefined) return;

      if (cardRecord) {
        // Fire and forget. A dropped grade costs one review slot, and blocking
        // the next card on a round trip is far worse for a study session.
        grade.mutate({ cardId: cardRecord.id, cardIndex: position, grade: value });
      }

      setRevealed(false);

      if (value === "again") {
        // To the back, not past. It will come round again this session.
        setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]!] : q));
        return;
      }

      setCompleted((c) => c + 1);
      setQueue((q) => {
        const rest = q.slice(1);
        if (rest.length === 0) router.replace(`/deck/${id}`);
        return rest;
      });
    },
    [position, cardRecord, grade, router, id],
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
        <Progress
          value={cards.length > 0 ? completed / cards.length : 0}
          tone={data?.deck.color}
          className="flex-1"
        />
        <Text variant="label">
          {completed} of {cards.length}
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
            <Text variant="caption">{current.hint ?? "Tap to flip"}</Text>
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
                accessibilityLabel="More options"
                onPress={() => setGradesOpen(true)}
              />
            </View>
          </View>
        }
      />

      {/* Again and Next sit below the card. Hard, Good and Easy live behind the
          icon on it, because they only change how far out the card is pushed. */}
      <View
        style={{ height: ACTION_AREA_HEIGHT, marginBottom: insets.bottom + 12 }}
        className="justify-end pt-3"
      >
        {revealed ? (
          <Animated.View entering={FadeIn.duration(180)} className="flex-row gap-2.5">
            <View className="flex-1">
              <Button
                label="Again"
                size="md"
                variant="destructive"
                onPress={() => answer("again")}
              />
              <Text variant="caption" className="mt-1 text-center text-ink-faint">
                {intervals.again}
              </Text>
            </View>
            <View className="flex-1">
              <Button label="Next" size="md" onPress={() => answer("good")} />
              <Text variant="caption" className="mt-1 text-center text-ink-faint">
                {intervals.good}
              </Text>
            </View>
          </Animated.View>
        ) : (
          <Button label="Show answer" onPress={reveal} />
        )}
      </View>

      <GradeSheet
        visible={gradesOpen}
        onClose={() => setGradesOpen(false)}
        onGrade={answer}
        intervals={intervals}
        onReport={() =>
          cardRecord && report.mutate({ cardId: cardRecord.id, reason: "user_flag" })
        }
      />

    </View>
  );
}
