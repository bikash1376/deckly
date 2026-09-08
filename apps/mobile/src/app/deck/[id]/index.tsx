import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CaretRight,
  ChatCircle,
  Flag,
  Sparkle,
  PencilSimple,
  Trash,
  Cards as CardsIcon,
} from "phosphor-react-native";
import { CREDIT_COST, type CardKind } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { Card, PressableCard } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import { Skeleton, SkeletonCardBlock } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CardContent } from "@/features/decks/card-content";
import {
  useDeck,
  useGenerateCard,
  useReportCard,
  useWeakTopics,
  useDeleteDeck,
} from "@/features/decks/hooks";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { deckClass, raw } from "@/theme";

type Generatable = Exclude<CardKind, "seed">;

const GENERATABLE: { kind: Generatable; label: string }[] = [
  { kind: "summary", label: "Summary" },
  { kind: "key_concepts", label: "Key concepts" },
  { kind: "cheat_sheet", label: "Cheat sheet" },
  { kind: "eli5", label: "Explain simply" },
  { kind: "exam_questions", label: "Exam questions" },
];

const TITLES: Record<string, string> = {
  summary: "Summary",
  key_concepts: "Key concepts",
  cheat_sheet: "Cheat sheet",
  eli5: "Explain simply",
  exam_questions: "Exam questions",
};

export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading, isError } = useDeck(id);
  const { data: weakTopics } = useWeakTopics(id);
  const generate = useGenerateCard(id);
  const report = useReportCard();
  const removeDeck = useDeleteDeck();

  const [pending, setPending] = useState<Generatable | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generated = useMemo(
    () => new Set((data?.cards ?? []).map((c) => c.kind)),
    [data?.cards],
  );

  const remaining = GENERATABLE.filter((g) => !generated.has(g.kind));

  const run = useCallback(
    async (kind: Generatable) => {
      setPending(kind);
      setError(null);
      try {
        await generate.mutateAsync(kind);
      } catch (caught) {
        if (caught instanceof ApiError && caught.isOutOfCredits) {
          router.push("/paywall");
        } else {
          setError("Could not generate that. Try again in a moment.");
        }
      } finally {
        setPending(null);
      }
    },
    [generate, router],
  );

  if (isLoading) {
    return (
      <View className="flex-1 px-gutter" style={{ paddingTop: insets.top + 12 }}>
        <Skeleton className="h-11 w-11 rounded-pill" />
        <Skeleton className="mt-5 h-[186px] rounded-card" />
        <View className="mt-6 gap-2.5">
          <Skeleton className="h-[70px] rounded-card" />
          <Skeleton className="h-[70px] rounded-card" />
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View className="flex-1 justify-center" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={CardsIcon}
          title="Could not open this deck"
          body="It may have been deleted, or your connection dropped. Go back and try again."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const { deck, cards, outline } = data;
  const progress = deck.cardsTotal > 0 ? deck.cardsDone / deck.cardsTotal : 0;
  /** A deck built by hand has no source text, so nothing can be generated from it. */
  const hasSource = deck.tldr.trim().length >= 40;

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="pb-16"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-row items-center justify-between px-gutter">
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />
        <IconButton
          icon={Trash}
          tone="bare"
          accessibilityLabel="Delete this deck"
          onPress={() =>
            Alert.alert(
              `Delete "${data.deck.title}"?`,
              "Its cards and everything you have reviewed in it go too. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    removeDeck.mutate(id);
                    router.replace("/(tabs)");
                  },
                },
              ],
            )
          }
        />
      </View>

      {/* Coloured hero. The deck's identity is the only place its colour is
          used at full strength; everything below stays neutral so the content
          reads rather than competes. */}
      <View className={cn("mx-gutter mt-4 rounded-card p-5", deckClass[deck.color].bg)}>
        <Chip label={deck.subject} tone="outline" className="border-0 bg-ink-inverse/20" />
        <Text variant="title" className="mt-3 text-ink-inverse">
          {deck.title}
        </Text>
        <Text variant="body" className="mt-2 text-ink-inverse/80">
          {deck.tldr}
        </Text>

        <Progress value={progress} tone="inverse" onColor className="mt-4" />
        <View className="mt-2 flex-row justify-between">
          <Text variant="caption" className="text-ink-inverse/80">
            {deck.cardsTotal > 0
              ? `${deck.cardsDone} of ${deck.cardsTotal} cards done`
              : "No flashcards yet"}
          </Text>
          <Text variant="caption" className="text-ink-inverse/80">
            About {deck.estimatedMinutes} min
          </Text>
        </View>
      </View>

      <View className="mt-6 px-gutter">
        <Text variant="overline" className="mb-2.5">
          Ready
        </Text>

        {/* On a hand built deck there is nothing to generate from, so tapping
            the row opens the editor instead of spending credits. */}
        <StudyRow
          title="Flashcards"
          subtitle={
            generated.has("flashcards")
              ? `${deck.cardsTotal} cards`
              : hasSource
                ? `Not made yet, ${CREDIT_COST.flashcards} credits`
                : "Not written yet, tap to start"
          }
          onPress={
            generated.has("flashcards")
              ? () => router.push(`/deck/${id}/flashcards`)
              : hasSource
                ? () => run("flashcards")
                : () => router.push(`/deck/${id}/edit-flashcards`)
          }
          busy={pending === "flashcards"}
          onEdit={() => router.push(`/deck/${id}/edit-flashcards`)}
        />

        <StudyRow
          title="Quiz"
          subtitle={
            generated.has("quiz")
              ? "Test yourself"
              : hasSource
                ? `Not made yet, ${CREDIT_COST.quiz} credits`
                : "Not written yet, tap to start"
          }
          onPress={
            generated.has("quiz")
              ? () => router.push(`/deck/${id}/quiz`)
              : hasSource
                ? () => run("quiz")
                : () => router.push(`/deck/${id}/edit-quiz`)
          }
          busy={pending === "quiz"}
          onEdit={() => router.push(`/deck/${id}/edit-quiz`)}
        />

        {/* Only meaningful when there is source material behind the deck. A
            hand built one has none, so the row would charge for an answer
            drawn from nothing. */}
        {hasSource ? (
          <StudyRow
            title="Ask this deck"
            subtitle={`Questions about the source, ${CREDIT_COST.deck_chat} credit each`}
            icon={ChatCircle}
            onPress={() => router.push(`/deck/${id}/chat`)}
          />
        ) : null}
      </View>

      {weakTopics && weakTopics.length > 0 ? (
        <View className="mt-7 px-gutter">
          <Text variant="overline" className="mb-2.5">
            Keeps catching you out
          </Text>
          <Card className="gap-3 p-4">
            {weakTopics.map((topic) => (
              <View key={topic.concept} className="flex-row items-center justify-between gap-3">
                <Text variant="subheading" className="flex-1">
                  {topic.concept}
                </Text>
                <Chip
                  label={`${topic.wrong} of ${topic.total} wrong`}
                  tone={topic.wrong / topic.total > 0.5 ? "danger" : "neutral"}
                />
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {outline.length > 0 && cards.length === 0 ? (
        <View className="mt-7 px-gutter">
          <Text variant="overline" className="mb-2.5">
            What is in here
          </Text>
          <Card className="gap-3 p-4">
            {outline.map((section, i) => (
              <View key={i} className="gap-1">
                <Text variant="subheading" className="font-body-sb">
                  {section.heading}
                </Text>
                {section.points.map((point, j) => (
                  <Text key={j} variant="caption">
                    {point}
                  </Text>
                ))}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {cards
        .filter((card) => card.kind !== "flashcards" && card.kind !== "quiz")
        .map((card) => (
          <View key={card.id} className="mt-7 px-gutter">
            <View className="mb-2.5 flex-row items-center justify-between">
              <Text variant="overline">{TITLES[card.kind] ?? card.kind}</Text>
              {/* Required for a Play Store GenAI listing: every generated
                  surface needs a way to report it. */}
              <IconButton
                icon={Flag}
                tone="bare"
                size="sm"
                accessibilityLabel={`Report this ${TITLES[card.kind] ?? "card"}`}
                onPress={() => report.mutate({ cardId: card.id, reason: "user_flag" })}
              />
            </View>
            <Card className="p-4">
              <CardContent card={card} />
            </Card>
          </View>
        ))}

      {pending && pending !== "flashcards" && pending !== "quiz" ? (
        <View className="mt-7 px-gutter">
          <Text variant="overline" className="mb-2.5">
            {TITLES[pending]}
          </Text>
          <Card className="p-4">
            <SkeletonCardBlock />
          </Card>
        </View>
      ) : null}

      {remaining.length > 0 && hasSource ? (
        <View className="mt-7 px-gutter">
          <Text variant="overline" className="mb-2.5">
            Generate
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {remaining.map((item) => (
              <Chip
                key={item.kind}
                label={`${item.label}, ${CREDIT_COST[item.kind]}`}
                tone="outline"
                icon={Sparkle}
                onPress={() => run(item.kind)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {error ? (
        <Text variant="caption" className="mt-5 px-gutter text-danger">
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function StudyRow({
  title,
  subtitle,
  onPress,
  onEdit,
  busy,
  icon: IconComponent,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Present on anything that can also be written by hand. */
  onEdit?: () => void;
  busy?: boolean;
  icon?: typeof ChatCircle;
}) {
  return (
    <PressableCard
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={`${title}. ${subtitle}`}
      className="mb-2.5 flex-row items-center justify-between p-4"
    >
      <View className="flex-1">
        <Text variant="heading">{busy ? "Generating" : title}</Text>
        <Text variant="caption">{subtitle}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        {onEdit ? (
          <IconButton
            icon={PencilSimple}
            tone="bare"
            size="sm"
            accessibilityLabel={`Write ${title.toLowerCase()} by hand`}
            onPress={onEdit}
          />
        ) : null}
        {IconComponent ? (
          <IconComponent size={19} color={raw.inkFaint} weight="regular" />
        ) : (
          <CaretRight size={19} color={raw.inkFaint} weight="regular" />
        )}
      </View>
    </PressableCard>
  );
}
