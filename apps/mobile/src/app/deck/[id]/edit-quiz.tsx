import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { ArrowLeft, Plus, Trash, Check } from "phosphor-react-native";
import { Quiz as QuizSchema } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { useDeck, useSaveQuiz } from "@/features/decks/hooks";
import { cn } from "@/lib/cn";
import { raw } from "@/theme";

const LETTERS = ["A", "B", "C", "D"];

interface Draft {
  key: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  concept: string;
}

const blank = (): Draft => ({
  key: `${Date.now()}-${Math.random()}`,
  question: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  concept: "",
});

/**
 * Write quiz questions by hand. Free, like manual flashcards.
 *
 * Four options is fixed rather than variable. It matches what the quiz screen
 * renders and what the generated schema produces, so a hand written question
 * and a generated one are the same shape and nothing downstream has to care
 * which is which.
 */
export default function EditQuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data } = useDeck(id);
  const save = useSaveQuiz(id);

  const [drafts, setDrafts] = useState<Draft[]>([blank()]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated || !data) return;
    const existing = data.cards.find((c) => c.kind === "quiz");
    if (existing) {
      const parsed = QuizSchema.safeParse(existing.content);
      if (parsed.success && parsed.data.questions.length > 0) {
        setDrafts(
          parsed.data.questions.map((q, i) => ({
            key: `existing-${i}`,
            question: q.question,
            options: [...q.options],
            correctIndex: q.correctIndex,
            explanation: q.explanation,
            concept: q.concept,
          })),
        );
      }
    }
    setHydrated(true);
  }, [data, hydrated]);

  const patch = useCallback((key: string, changes: Partial<Draft>) => {
    setDrafts((rows) => rows.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  }, []);

  const setOption = useCallback((key: string, index: number, value: string) => {
    setDrafts((rows) =>
      rows.map((r) =>
        r.key === key
          ? { ...r, options: r.options.map((o, i) => (i === index ? value : o)) }
          : r,
      ),
    );
  }, []);

  const submit = useCallback(async () => {
    const questions = drafts
      .filter(
        (d) =>
          d.question.trim() &&
          d.options.every((o) => o.trim()) &&
          d.explanation.trim(),
      )
      .map((d) => ({
        question: d.question.trim(),
        options: d.options.map((o) => o.trim()),
        correctIndex: d.correctIndex,
        explanation: d.explanation.trim(),
        concept: d.concept.trim() || d.question.trim().slice(0, 40),
      }));

    if (questions.length === 0) {
      setError(
        "Finish at least one question: all four options filled in, and a reason for the right answer.",
      );
      return;
    }

    setError(null);
    try {
      await save.mutateAsync(questions);
      router.back();
    } catch {
      setError("Could not save. Check your connection and try again.");
    }
  }, [drafts, save, router]);

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
        <Text variant="caption">{drafts.length === 1 ? "1 question" : `${drafts.length} questions`}</Text>
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pb-8 pt-2 gap-2.5"
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title" className="mb-2">
          {data?.deck.title ?? "Quiz"}
        </Text>

        {drafts.map((draft, index) => (
          <Animated.View
            key={draft.key}
            layout={LinearTransition.springify().damping(20)}
            entering={FadeIn.duration(160)}
          >
            <Card className="p-4">
              <View className="mb-2 flex-row items-center justify-between">
                <Text variant="overline">Question {index + 1}</Text>
                <IconButton
                  icon={Trash}
                  tone="bare"
                  size="sm"
                  accessibilityLabel={`Delete question ${index + 1}`}
                  onPress={() =>
                    setDrafts((rows) =>
                      rows.length === 1 ? [blank()] : rows.filter((r) => r.key !== draft.key),
                    )
                  }
                />
              </View>

              <TextInput
                value={draft.question}
                onChangeText={(v) => patch(draft.key, { question: v })}
                placeholder="What are you asking?"
                placeholderTextColor={raw.inkFaint}
                selectionColor={raw.clay}
                multiline
                className="font-body-sb text-subheading text-ink"
              />

              <Text variant="caption" className="mt-3">
                Tap the circle to mark the right answer.
              </Text>

              <View className="mt-2 gap-2">
                {draft.options.map((option, i) => {
                  const correct = draft.correctIndex === i;
                  return (
                    <View key={i} className="flex-row items-center gap-2.5">
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: correct }}
                        accessibilityLabel={`Mark option ${LETTERS[i]} correct`}
                        onPress={() => patch(draft.key, { correctIndex: i })}
                        className={cn(
                          "h-7 w-7 items-center justify-center rounded-pill border-[1.5px]",
                          correct ? "border-success bg-success" : "border-hairline",
                        )}
                      >
                        {correct ? (
                          <Check size={14} color="#FFFFFF" weight="bold" />
                        ) : (
                          <Text variant="label" className="text-ink-faint">
                            {LETTERS[i]}
                          </Text>
                        )}
                      </Pressable>
                      <TextInput
                        value={option}
                        onChangeText={(v) => setOption(draft.key, i, v)}
                        placeholder={`Option ${LETTERS[i]}`}
                        placeholderTextColor={raw.inkFaint}
                        selectionColor={raw.clay}
                        className="flex-1 rounded-md border-[1.5px] border-hairline px-3 py-2 font-body text-body text-ink"
                      />
                    </View>
                  );
                })}
              </View>

              <View className="my-3 h-px bg-hairline" />

              <TextInput
                value={draft.explanation}
                onChangeText={(v) => patch(draft.key, { explanation: v })}
                placeholder="Why is that the right answer?"
                placeholderTextColor={raw.inkFaint}
                selectionColor={raw.clay}
                multiline
                className="font-body text-body text-ink"
              />
              <TextInput
                value={draft.concept}
                onChangeText={(v) => patch(draft.key, { concept: v })}
                placeholder="Topic this tests, optional"
                placeholderTextColor={raw.inkFaint}
                selectionColor={raw.clay}
                className="mt-2 font-body text-caption text-ink-muted"
              />
            </Card>
          </Animated.View>
        ))}

        <Button
          label="Add another question"
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
        <Button label="Save quiz" loading={save.isPending} onPress={submit} />
      </View>
    </KeyboardAvoidingView>
  );
}
