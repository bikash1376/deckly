import { useCallback } from "react";
import { Pressable, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { cn } from "@/lib/cn";
import { shadow } from "@/theme";
import { Text } from "./text";

/**
 * The "My Deck / Collections" toggle from the reference screens.
 *
 * The active pill is a laid out sibling animated with `LinearTransition` rather
 * than an absolutely positioned indicator measured with `onLayout`. Same motion,
 * and it stays correct when a label's width changes with the content.
 */
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
      className={cn("h-[46px] flex-row gap-0.5 rounded-pill bg-bg-sunken p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => select(option.value)}
            className="flex-1"
          >
            <Animated.View
              layout={LinearTransition.springify().damping(20).stiffness(220)}
              style={active ? shadow.card : undefined}
              className={cn(
                "h-full items-center justify-center rounded-pill",
                active ? "bg-surface" : "bg-transparent",
              )}
            >
              <Text
                variant="subheading"
                className={active ? "text-ink" : "text-ink-muted"}
              >
                {option.label}
              </Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}
