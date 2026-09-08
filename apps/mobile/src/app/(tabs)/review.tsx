import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Lightning, Fire, Flag } from "phosphor-react-native";
import type { ReviewGrade } from "@retenit/shared";

import { FlipCard } from "@/components/flip-card";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useReviewQueue, useGradeCard } from "@/features/review/hooks";
import { useReportCard } from "@/features/decks/hooks";
import { INITIAL_SRS, previewGrades } from "@/lib/srs";
import { raw, shadow } from "@/theme";

/** The floating tab bar's own pill height plus the padding it sits on. */
const TAB_BAR_CLEARANCE = 62 + 10;

/**
 * Height reserved for the grade buttons.
 *
 * Two rows of 46pt buttons each with a caption beneath (66), the gap between
 * the rows (10), and the space above (12). The previous 148 was six points
 * short, which clipped the bottom row and stole the difference from the card.
 */
const ACTION_AREA_HEIGHT = 12 + 66 + 10 + 66;

const GRADES: { grade: ReviewGrade; label: string }[] = [
  { grade: "again", label: "Again" },
  { grade: "hard", label: "Hard" },
  { grade: "good", label: "Good" },
  { grade: "easy", label: "Easy" },
];

/**
 * The daily queue, mixed across every deck.
 *
 * This screen is why the app gets opened on day nine, so it costs no credits
 * and is never gated behind premium. Generating material is the paid product;
 * remembering it is the reason to come back.
 */
export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading, refetch } = useReviewQueue();
  const grade = useGradeCard();
  const report = useReportCard();

  /**
   * Positions still to get right, plus how many are done.
   *
   * "Again" sends the card to the back of the queue rather than counting as
   * progress: the bar should measure what you know, not how many buttons you
   * have pressed.
   */
  const [queue, setQueue] = useState<number[]>([]);
  const [reviewed, setReviewed] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const cards = data?.cards ?? [];

  useEffect(() => {
    if (cards.length > 0 && queue.length === 0 && reviewed === 0) {
      setQueue(cards.map((_, i) => i));
    }
  }, [cards, queue.length, reviewed]);

  const position = queue[0];
  const current = position === undefined ? undefined : cards[position];
  const intervals = useMemo(() => previewGrades(INITIAL_SRS), []);

  const answer = useCallback(
    (value: ReviewGrade) => {
      if (!current) return;
      Haptics.selectionAsync().catch(() => {});
      grade.mutate({ cardId: current.id, grade: value });
      setRevealed(false);

      if (value === "again") {
        setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]!] : q));
        return;
      }

      setReviewed((n) => n + 1);
      setQueue((q) => q.slice(1));
    },
    [current, grade],
  );

  if (isLoading) {
    return (
      <View className="flex-1 px-gutter" style={{ paddingTop: insets.top + 12 }}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-[360px] rounded-card" />
      </View>
    );
  }

  // Finished the queue, or nothing was due to begin with.
  if (!current) {
    const didWork = reviewed > 0;
    return (
      <View
        className="flex-1 justify-center px-gutter"
        style={{ paddingBottom: insets.bottom + 96 }}
      >
        <EmptyState
          icon={didWork ? Fire : Lightning}
          title={didWork ? "Queue clear" : "Nothing due right now"}
          body={
            didWork
              ? `You reviewed ${reviewed} ${reviewed === 1 ? "card" : "cards"}. Come back tomorrow and the next batch will be waiting.`
              : "Cards come due on their own schedule. Make a deck and generate flashcards to start filling this up."
          }
          actionLabel={didWork ? undefined : "New deck"}
          onAction={didWork ? undefined : () => router.push("/create")}
        />
        {didWork && data?.streak ? (
          <Chip
            label={data.streak === 1 ? "1 day streak" : `${data.streak} day streak`}
            tone="amber"
            icon={Fire}
            className="self-center"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      className="flex-1 px-gutter"
      style={{
        paddingTop: insets.top + 12,
        // Clears the floating tab bar: its 62pt pill plus whatever padding it
        // sits on, plus a gap so the card does not touch it.
        paddingBottom: TAB_BAR_CLEARANCE + (insets.bottom > 0 ? insets.bottom : 14),
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text variant="display">Review</Text>
        {data?.streak ? (
          <Chip
            label={data.streak === 1 ? "1 day" : `${data.streak} days`}
            tone="amber"
            icon={Fire}
          />
        ) : null}
      </View>

      <View className="mt-4 flex-row items-center gap-3">
        <Progress value={reviewed / Math.max(cards.length, 1)} className="flex-1" />
        <Text variant="label">{queue.length} left</Text>
      </View>

      {/* Takes the space left over after the action area below has had its
          share, rather than filling the screen and being overlapped by it. */}
      <FlipCard
        flipped={revealed}
        onPress={() => setRevealed(true)}
        accessibilityLabel={revealed ? "Answer shown" : "Tap to reveal the answer"}
        className="mt-5 min-h-0 flex-1"
        front={
          <View className="flex-1 justify-between p-6">
            <Chip label={current.deckTitle} tone={current.deckColor} />
            <View>
              <Text variant="overline" className="mb-3">
                Question
              </Text>
              <Text variant="title">{current.front}</Text>
              {current.hint ? (
                <Text variant="caption" className="mt-4">
                  {current.hint}
                </Text>
              ) : null}
            </View>
            <View className="flex-row items-center justify-between">
              <Text variant="caption">
                {current.lapses > 2 ? "You have missed this one before" : "Tap to flip"}
              </Text>
              <IconButton
                icon={Flag}
                tone="bare"
                size="sm"
                accessibilityLabel="Report this card"
                onPress={() => report.mutate({ cardId: current.id, reason: "user_flag" })}
              />
            </View>
          </View>
        }
        back={
          <View className="flex-1 justify-between p-6">
            <Chip label={current.deckTitle} tone={current.deckColor} />
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
                onPress={() => report.mutate({ cardId: current.id, reason: "user_flag" })}
              />
            </View>
          </View>
        }
      />

      {/* Fixed height, always present. Reserving the space means revealing the
          answer does not resize the card underneath it, which on a long answer
          would make the text jump as you read it. */}
      <View style={{ height: ACTION_AREA_HEIGHT }} className="justify-end pt-4">
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
          <Button label="Show answer" onPress={() => setRevealed(true)} />
        )}
      </View>
    </View>
  );
}
