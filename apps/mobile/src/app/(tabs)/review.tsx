import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Lightning, Fire, Flag } from "phosphor-react-native";
import type { ReviewGrade } from "@retenit/shared";

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

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const cards = data?.cards ?? [];
  const current = cards[index];
  const intervals = useMemo(() => previewGrades(INITIAL_SRS), []);

  const answer = useCallback(
    (value: ReviewGrade) => {
      if (!current) return;
      Haptics.selectionAsync().catch(() => {});
      grade.mutate({ cardId: current.id, grade: value });
      setReviewed((n) => n + 1);
      setRevealed(false);
      setIndex((i) => i + 1);
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
    <View className="flex-1 px-gutter" style={{ paddingTop: insets.top + 12 }}>
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
        <Progress value={index / Math.max(cards.length, 1)} className="flex-1" />
        <Text variant="label">{cards.length - index} left</Text>
      </View>

      <Pressable
        onPress={() => setRevealed(true)}
        accessibilityRole="button"
        accessibilityLabel={revealed ? "Answer shown" : "Tap to reveal the answer"}
        className="mt-6 flex-1"
        style={{ marginBottom: insets.bottom + 96 }}
      >
        <View
          style={shadow.card}
          className="flex-1 justify-between rounded-card bg-surface p-6"
        >
          <Chip label={current.deckTitle} tone={current.deckColor} />

          <View>
            <Text variant="overline" className="mb-3">
              {revealed ? "Answer" : "Question"}
            </Text>
            <Text variant="title">{revealed ? current.back : current.front}</Text>
            {!revealed && current.hint ? (
              <Text variant="caption" className="mt-4">
                {current.hint}
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center justify-between">
            <Text variant="caption">
              {revealed
                ? "How well did you know it?"
                : current.lapses > 2
                  ? "You have missed this one before"
                  : "Tap to flip"}
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
      </Pressable>

      <View
        className="absolute inset-x-gutter"
        style={{ bottom: insets.bottom + 96 }}
        pointerEvents="box-none"
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
        ) : null}
      </View>
    </View>
  );
}
