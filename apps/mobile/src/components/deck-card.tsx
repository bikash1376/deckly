import { View } from "react-native";
import { ArrowUpRight, Lock } from "phosphor-react-native";
import { cn } from "@/lib/cn";
import { colorForId, deckClass, shadow, type DeckColorKey } from "@/theme";
import { Text } from "./ui/text";
import { PressableCard } from "./ui/card";

/**
 * The folder silhouette from the reference grid.
 *
 * Built from stacked Views rather than an SVG path. The shape is two white sheets
 * peeking above a coloured face, which composes exactly as well out of rounded
 * rectangles, and Views animate and recycle in a list far more cheaply than an
 * SVG does. If the tab ever needs a true die-cut curve, that is the moment to
 * reach for a path, not before.
 */

export interface DeckCardProps {
  id: string;
  title: string;
  /** Cards completed and total. Omit for a deck with nothing generated yet. */
  done?: number;
  total?: number;
  /** Overrides the id-derived colour. Only for previews and onboarding. */
  color?: DeckColorKey;
  locked?: boolean;
  onPress?: () => void;
}

export function DeckCard({
  id,
  title,
  done,
  total,
  color,
  locked = false,
  onPress,
}: DeckCardProps) {
  const key = color ?? colorForId(id);
  const tone = deckClass[key];

  const hasProgress = typeof done === "number" && typeof total === "number" && total > 0;
  const subtitle = !hasProgress
    ? "Not started"
    : done === total
      ? "All cards done"
      : `${done} of ${total} cards done`;

  return (
    <PressableCard
      tone="flat"
      onPress={onPress}
      accessibilityLabel={`${title}. ${subtitle}`}
      className="bg-transparent"
    >
      {/* Paper stack. Inset and offset so each sheet reads as a separate leaf. */}
      <View className="pt-3">
        <View
          style={shadow.card}
          className="absolute left-4 right-4 top-0 h-7 rounded-t-[9px] bg-surface opacity-60"
        />
        <View
          style={shadow.card}
          className="absolute left-2.5 right-2.5 top-1.5 h-7 rounded-t-[9px] bg-surface"
        />

        <View
          style={shadow.card}
          className={cn(
            "aspect-[1/0.93] justify-end rounded-t-[14px] rounded-b-tile p-3.5",
            tone.bg,
          )}
        >
          {locked ? (
            <Lock size={19} color="rgba(255,255,255,0.92)" weight="regular" />
          ) : (
            <ArrowUpRight size={19} color="rgba(255,255,255,0.92)" weight="regular" />
          )}
        </View>
      </View>

      <Text variant="heading" className="mt-3 font-display" numberOfLines={2}>
        {title}
      </Text>
      <Text variant="caption" className="mt-0.5 text-ink-faint" numberOfLines={1}>
        {subtitle}
      </Text>
    </PressableCard>
  );
}
