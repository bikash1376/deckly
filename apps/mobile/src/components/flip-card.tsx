import { type ReactNode, useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { shadow } from "@/theme";

/**
 * A card that turns over.
 *
 * A real rotation on the Y axis rather than a crossfade. The two are not
 * interchangeable: a crossfade says the content changed, a flip says this is
 * the same card seen from the other side, which is exactly the mental model a
 * flashcard needs. It is also the difference between the answer feeling
 * revealed and the answer feeling replaced.
 *
 * Both faces are laid on top of each other and rotated 180 degrees apart, with
 * `backfaceVisibility: hidden` so only the one pointing at you draws. The
 * perspective value is what stops it looking like a flat horizontal squash.
 */
export interface FlipCardProps {
  flipped: boolean;
  onPress?: () => void;
  front: ReactNode;
  back: ReactNode;
  accessibilityLabel?: string;
  className?: string;
}

/** Slow enough to read as a turn, quick enough not to sit through. */
const DURATION = 420;

export function FlipCard({
  flipped,
  onPress,
  front,
  back,
  accessibilityLabel,
  className,
}: FlipCardProps) {
  const spin = useSharedValue(flipped ? 1 : 0);

  useEffect(() => {
    spin.value = withTiming(flipped ? 1 : 0, {
      duration: DURATION,
      // Eased both ends: a linear rotation reads mechanical, and the card
      // should feel like it has some weight to it.
      easing: Easing.inOut(Easing.cubic),
    });
  }, [flipped, spin]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(spin.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(spin.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      className={className}
    >
      <View className="flex-1">
        <Animated.View
          style={[frontStyle, shadow.card, { backfaceVisibility: "hidden" }]}
          className="absolute inset-0 rounded-card bg-surface"
        >
          {front}
        </Animated.View>

        <Animated.View
          style={[backStyle, shadow.card, { backfaceVisibility: "hidden" }]}
          className="absolute inset-0 rounded-card bg-surface"
        >
          {back}
        </Animated.View>
      </View>
    </Pressable>
  );
}
