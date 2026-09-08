import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

/**
 * The press feel used on every tappable surface in the app.
 *
 * Springs rather than timings: a tap that eases linearly back to rest feels
 * like a web button. The damping is high enough that it settles without a
 * visible bounce, which would read as toy-like against this palette.
 */
const SPRING = { damping: 18, stiffness: 320, mass: 0.6 } as const;

export interface PressScaleOptions {
  /** How far it compresses. Small controls need to travel less to read. */
  to?: number;
  /** Fires on press in, so the tap feels answered before navigation starts. */
  haptic?: "light" | "medium" | "none";
}

export function usePressScale({ to = 0.96, haptic = "light" }: PressScaleOptions = {}) {
  const scale = useSharedValue(1);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(to, SPRING);
    if (haptic !== "none") {
      Haptics.impactAsync(
        haptic === "medium"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => {
        // Haptics are unavailable on some devices and in the emulator. The
        // press must not fail because the motor did.
      });
    }
  }, [scale, to, haptic]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING);
  }, [scale]);

  return { style, onPressIn, onPressOut };
}
