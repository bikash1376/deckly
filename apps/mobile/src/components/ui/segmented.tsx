import { useCallback, useEffect, useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { cn } from "@/lib/cn";
import { shadow } from "@/theme";
import { Text } from "./text";

/**
 * Segmented control with a sliding thumb.
 *
 * The thumb is one absolutely positioned view that translates between equal
 * width segments. Nothing in the layout changes when the selection does.
 *
 * The earlier version animated the segments themselves with LinearTransition,
 * which meant the selected one appeared in place rather than arriving from
 * anywhere, and the unselected ones twitched as it did. Moving a single object
 * is both cheaper and easier to follow: your eye tracks the thumb instead of
 * re-reading the whole control.
 */

const SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;

const TRACK_HEIGHT = 46;
const TRACK_PADDING = 4;

export interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);

  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = options.length > 0 ? trackWidth / options.length : 0;
  const offset = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth === 0) return;
    offset.value = withSpring(index * segmentWidth, SPRING);
  }, [index, segmentWidth, offset]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const select = useCallback(
    (next: T) => {
      if (next === value) return;
      Haptics.selectionAsync().catch(() => {});
      onChange(next);
    },
    [value, onChange],
  );

  return (
    <View
      accessibilityRole="tablist"
      style={{ height: TRACK_HEIGHT, padding: TRACK_PADDING }}
      className={cn("rounded-pill bg-bg-sunken", className)}
    >
      <View onLayout={onLayout} className="flex-1 flex-row">
        {segmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[thumbStyle, shadow.card, { width: segmentWidth }]}
            className="absolute bottom-0 left-0 top-0 rounded-pill bg-surface"
          />
        ) : null}

        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              onPress={() => select(option.value)}
              className="flex-1 items-center justify-center"
            >
              <SegmentLabel label={option.label} active={active} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * The label crossfades between muted and ink rather than switching instantly,
 * so it settles at the same time as the thumb rather than a frame ahead of it.
 */
function SegmentLabel({ label, active }: { label: string; active: boolean }) {
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, on]);

  const restingStyle = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const activeStyle = useAnimatedStyle(() => ({ opacity: on.value }));

  return (
    <View>
      <Animated.View style={restingStyle}>
        <Text variant="subheading" className="text-ink-muted">
          {label}
        </Text>
      </Animated.View>
      <Animated.View style={activeStyle} className="absolute">
        <Text variant="subheading" className="text-ink">
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}
