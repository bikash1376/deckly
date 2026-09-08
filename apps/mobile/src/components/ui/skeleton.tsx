import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  ReduceMotion,
} from "react-native-reanimated";
import { cn } from "@/lib/cn";

/**
 * Generation takes seconds, so the wait gets a skeleton rather than a spinner:
 * a spinner says "wait", a skeleton says "here is the shape of what is coming",
 * which makes the same duration feel shorter.
 *
 * The pulse is opacity only. Animating a moving highlight gradient costs a
 * shader pass per frame for an effect nobody consciously notices.
 */
export function Skeleton({ className }: { className?: string }) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.9, { duration: 780, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
      undefined,
      ReduceMotion.System,
    );
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style}
      className={cn("rounded-md bg-bg-sunken", className)}
    />
  );
}

/** The placeholder shown while a deck's cards are being generated. */
export function SkeletonCardBlock() {
  return (
    <View className="gap-3" accessibilityLabel="Generating">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/5" />
    </View>
  );
}
