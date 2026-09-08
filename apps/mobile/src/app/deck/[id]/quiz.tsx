import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { X, Check, Flag, Cards as CardsIcon } from "phosphor-react-native";
import { Quiz as QuizSchema } from "@deckly/shared";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { useDeck, useReportCard } from "@/features/decks/hooks";
import { cn } from "@/lib/cn";
import { deckClass, raw } from "@/theme";

const LETTERS = ["A", "B", "C", "D"];

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data } = useDeck(id);
  const report = useReportCard();

  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrongConcepts, setWrongConcepts] = useState<string[]>([]);

  const cardRecord = useMemo(
    () => data?.cards.find((c) => c.kind === "quiz"),
    [data?.cards],
  );

  const questions = useMemo(() => {
    if (!cardRecord) return [];
    const parsed = QuizSchema.safeParse(cardRecord.content);
    return parsed.success ? parsed.data.questions : [];
  }, [cardRecord]);

  const current = questions[index];
  const done = index >= questions.length;

  const pick = useCallback(
    (option: number) => {
      if (picked !== null || !current) return;
      const correct = option === current.correctIndex;

      Haptics.notificationAsync(
        correct
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});

      setPicked(option);
      if (correct) setScore((s) => s + 1);
      else setWrongConcepts((w) => [...w, current.concept]);
    },
    [picked, current],
  );

  const next = useCallback(() => {
    setPicked(null);
    setIndex((i) => i + 1);
  }, []);

  if (!cardRecord || questions.length === 0) {
    return (
      <View className="flex-1 justify-center" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={CardsIcon}
          title="No quiz yet"
          body="Generate a quiz from the deck screen and it will show up here."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (done) {
    // Weak topics are the reason the quiz exists. Lead with them, not the score.
    const unique = Array.from(new Set(wrongConcepts));
    return (
      <View className="flex-1 px-gutter" style={{ paddingTop: insets.top + 60 }}>
        <Text variant="hero">
          {score} of {questions.length}
        </Text>
        <Text variant="bodyLarge" className="mt-3 text-ink-muted">
          {score === questions.length
            ? "Every one right. This deck is in good shape."
            : "Worth another look before your exam."}
        </Text>

        {unique.length > 0 ? (
          <View className="mt-8">
            <Text variant="overline" className="mb-2.5">
              Go over these again
            </Text>
            <Card className="gap-2.5 p-4">
              {unique.map((concept) => (
                <Text key={concept} variant="subheading">
                  {concept}
                </Text>
              ))}
            </Card>
          </View>
        ) : null}

        <View className="flex-1" />
        <View style={{ paddingBottom: insets.bottom + 24 }} className="gap-2.5">
          <Button label="Back to deck" onPress={() => router.replace(`/deck/${id}`)} />
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => {
              setIndex(0);
              setScore(0);
              setPicked(null);
              setWrongConcepts([]);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center gap-3 px-gutter">
        <IconButton
          icon={X}
          tone="sunken"
          size="sm"
          accessibilityLabel="End quiz"
          onPress={() => router.back()}
        />
        <Progress
          value={(index + 1) / questions.length}
          tone={data?.deck.color}
          className="flex-1"
        />
        <Text variant="label">
          {index + 1} of {questions.length}
        </Text>
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-8 pt-6">
        <Text variant="title">{current.question}</Text>

        <View className="mt-6 gap-2.5">
          {current.options.map((option, i) => {
            const isCorrect = i === current.correctIndex;
            const isPicked = i === picked;
            const answered = picked !== null;

            const state = !answered
              ? "idle"
              : isCorrect
                ? "correct"
                : isPicked
                  ? "wrong"
                  : "muted";

            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ selected: isPicked, disabled: answered }}
                disabled={answered}
                onPress={() => pick(i)}
                className={cn(
                  "flex-row items-center gap-3 rounded-md border-[1.5px] px-4 py-3.5",
                  state === "idle" && "border-hairline bg-surface",
                  state === "correct" && "border-success bg-surface-alt",
                  state === "wrong" && "border-danger bg-danger-tint",
                  state === "muted" && "border-hairline bg-surface opacity-50",
                )}
              >
                <View
                  className={cn(
                    "h-[26px] w-[26px] items-center justify-center rounded-pill",
                    state === "correct"
                      ? "bg-success"
                      : state === "wrong"
                        ? "bg-danger"
                        : "bg-bg-sunken",
                  )}
                >
                  {state === "correct" ? (
                    <Check size={14} color="#FFFFFF" weight="bold" />
                  ) : state === "wrong" ? (
                    <X size={14} color="#FFFFFF" weight="bold" />
                  ) : (
                    <Text variant="label" className="text-ink-muted">
                      {LETTERS[i]}
                    </Text>
                  )}
                </View>
                <Text variant="body" className="flex-1">
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {picked !== null ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <View
              className={cn(
                "mt-5 rounded-card p-4",
                deckClass[data?.deck.color ?? "slate"].tint,
              )}
            >
              <View className="mb-1.5 flex-row items-center justify-between">
                <Text variant="overline" className={deckClass[data?.deck.color ?? "slate"].text}>
                  Why
                </Text>
                <IconButton
                  icon={Flag}
                  tone="bare"
                  size="sm"
                  accessibilityLabel="Report this question"
                  onPress={() => report.mutate({ cardId: cardRecord.id, reason: "user_flag" })}
                />
              </View>
              <Text variant="body">{current.explanation}</Text>
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {picked !== null ? (
        <View className="px-gutter" style={{ paddingBottom: insets.bottom + 20 }}>
          <Button
            label={index + 1 >= questions.length ? "See results" : "Next question"}
            onPress={next}
          />
        </View>
      ) : null}
    </View>
  );
}
