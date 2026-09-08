import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { cn } from "@/lib/cn";
import { raw, type DeckColorKey } from "@/theme";

export interface ProgressProps {
  /** 0 to 1. Values outside the range are clamped rather than overflowing. */
  value: number;
  /** Deck colour, or `ink` for screens that are not scoped to one deck. */
  tone?: DeckColorKey | "ink" | "inverse";
  /** Track colour, for use on a coloured surface where the default disappears. */
  onColor?: boolean;
  className?: string;
}

const FILL: Record<string, string> = {
  clay: raw.clay,
  slate: raw.slate,
  sage: raw.sage,
  mocha: raw.mocha,
  eucalyptus: raw.eucalyptus,
  plum: raw.plum,
  ink: raw.ink,
  inverse: "#FFFFFF",
};

export function Progress({ value, tone = "ink", onColor = false, className }: ProgressProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const width = useSharedValue(clamped);

  useEffect(() => {
    // Eased rather than sprung: progress overshooting past its own value and
    // settling back reads as a glitch, not as polish.
    width.value = withTiming(clamped, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [clamped, width]);

  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      className={cn(
        "h-1 w-full overflow-hidden rounded-pill",
        onColor ? "bg-ink-inverse/25" : "bg-bg-sunken",
        className,
      )}
    >
      <Animated.View
        style={[style, { backgroundColor: FILL[tone] ?? raw.ink }]}
        className="h-full rounded-pill"
      />
    </View>
  );
}
