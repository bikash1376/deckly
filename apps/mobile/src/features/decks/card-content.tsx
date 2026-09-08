import { View } from "react-native";
import {
  Summary,
  KeyConcepts,
  CheatSheet,
  Eli5,
  ExamQuestions,
  type Card as CardEntity,
} from "@deckly/shared";
import { Text } from "@/components/ui/text";

/**
 * Renders one generated card.
 *
 * Content is parsed here rather than trusted, because `cards.content` is jsonb
 * and a card written by an older prompt version can have a shape this build no
 * longer expects. A card that fails to parse renders as a quiet notice instead
 * of taking the screen down.
 */
export function CardContent({ card }: { card: CardEntity }) {
  switch (card.kind) {
    case "summary": {
      const parsed = Summary.safeParse(card.content);
      if (!parsed.success) return <Unreadable />;
      return (
        <View className="gap-4">
          {parsed.data.sections.map((section, i) => (
            <View key={i} className="gap-1.5">
              <Text variant="heading">{section.heading}</Text>
              <Text variant="body" className="text-ink-muted">
                {stripMarkdown(section.body)}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    case "key_concepts": {
      const parsed = KeyConcepts.safeParse(card.content);
      if (!parsed.success) return <Unreadable />;
      return (
        <View className="gap-3.5">
          {parsed.data.concepts.map((concept, i) => (
            <View key={i} className="gap-1">
              <Text variant="subheading" className="font-body-sb">
                {concept.term}
              </Text>
              <Text variant="body" className="text-ink-muted">
                {concept.definition}
              </Text>
              {concept.whyItMatters ? (
                <Text variant="caption" className="text-ink-faint">
                  {concept.whyItMatters}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      );
    }

    case "cheat_sheet": {
      const parsed = CheatSheet.safeParse(card.content);
      if (!parsed.success) return <Unreadable />;
      return (
        <View className="gap-4">
          {parsed.data.groups.map((group, i) => (
            <View key={i} className="gap-2">
              <Text variant="overline">{group.label}</Text>
              {group.lines.map((line, j) => (
                <View key={j} className="flex-row gap-2.5">
                  <View className="mt-2 h-1 w-1 rounded-pill bg-ink-faint" />
                  <Text variant="body" className="flex-1">
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    }

    case "eli5": {
      const parsed = Eli5.safeParse(card.content);
      if (!parsed.success) return <Unreadable />;
      return (
        <View className="gap-3">
          <Text variant="bodyLarge">{parsed.data.explanation}</Text>
          <View className="rounded-tile bg-amber-tint p-3.5">
            <Text variant="overline" className="mb-1">
              Think of it like
            </Text>
            <Text variant="body">{parsed.data.analogy}</Text>
          </View>
        </View>
      );
    }

    case "exam_questions": {
      const parsed = ExamQuestions.safeParse(card.content);
      if (!parsed.success) return <Unreadable />;
      return (
        <View className="gap-4">
          {parsed.data.questions.map((question, i) => (
            <View key={i} className="gap-1.5">
              <View className="flex-row items-baseline justify-between gap-3">
                <Text variant="subheading" className="flex-1 font-body-sb">
                  {question.prompt}
                </Text>
                <Text variant="caption" className="text-ink-faint">
                  {question.marks} marks
                </Text>
              </View>
              <Text variant="body" className="text-ink-muted">
                {question.modelAnswer}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    default:
      return <Unreadable />;
  }
}

function Unreadable() {
  return (
    <Text variant="caption" className="text-ink-faint">
      This card was made by an older version of the app and cannot be shown. Generate it
      again to get a fresh one.
    </Text>
  );
}

/**
 * The model is asked for markdown in body text, but React Native Text has no
 * markdown renderer and pulling one in for bold and bullets is not worth the
 * dependency. Strip the syntax rather than print asterisks at the user.
 */
function stripMarkdown(input: string): string {
  return input
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ");
}
