import { useCallback } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  LinearTransition,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Cards, NotePencil, Lightning, User, type Icon as PhosphorIcon } from "phosphor-react-native";
import { cn } from "@/lib/cn";
import { raw, shadow } from "@/theme";
import { Text } from "./ui/text";

/**
 * Floating pill navigation, matching the reference screens.
 *
 * The active tab does three things at once: it expands to reveal its label, its
 * pill fills with ink, and the icon crosses from `regular` to `fill`. Phosphor's
 * weight axis is what makes that last one free, and it is why this app does not
 * use Lucide: there is no second icon set to keep in sync.
 *
 * Width is animated with `LinearTransition` on the laid out tabs rather than an
 * absolutely positioned indicator driven by `onLayout`. Same motion, and it
 * cannot drift out of sync when a label's width changes.
 */

const ICONS: Record<string, { icon: PhosphorIcon; label: string }> = {
  index: { icon: Cards, label: "Decks" },
  pad: { icon: NotePencil, label: "Pad" },
  review: { icon: Lightning, label: "Review" },
  profile: { icon: User, label: "You" },
};

const SPRING = { damping: 20, stiffness: 240, mass: 0.7 } as const;

function Tab({
  routeKey,
  focused,
  onPress,
  onLongPress,
  badge,
}: {
  routeKey: string;
  focused: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  badge?: number;
}) {
  const entry = ICONS[routeKey];
  const press = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  if (!entry) return null;
  const { icon: IconComponent, label } = entry;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        press.value = withSpring(0.9, SPRING);
      }}
      onPressOut={() => {
        press.value = withSpring(1, SPRING);
      }}
    >
      <Animated.View
        layout={LinearTransition.springify().damping(20).stiffness(240)}
        style={pressStyle}
        className={cn(
          "h-11 flex-row items-center gap-[7px] rounded-pill",
          focused ? "bg-ink px-[17px]" : "px-3.5",
        )}
      >
        <View>
          <IconComponent
            size={22}
            color={focused ? "#FFFFFF" : raw.inkFaint}
            weight={focused ? "fill" : "regular"}
          />
          {badge && badge > 0 && !focused ? (
            <View className="absolute -right-1 -top-0.5 h-2 w-2 rounded-pill bg-clay" />
          ) : null}
        </View>

        {focused ? (
          <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(90)}>
            <Text variant="subheading" className="font-body-sb text-ink-inverse">
              {label}
            </Text>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export interface TabBarProps extends BottomTabBarProps {
  /** Number of flashcards due, shown as a dot on the Review tab. */
  dueCount?: number;
}

export function TabBar({ state, navigation, dueCount = 0 }: TabBarProps) {
  const insets = useSafeAreaInsets();

  const go = useCallback(
    (index: number) => {
      const route = state.routes[index];
      const focused = state.index === index;

      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (focused || event.defaultPrevented) return;
      Haptics.selectionAsync().catch(() => {});
      navigation.navigate(route.name, route.params);
    },
    [state, navigation],
  );

  return (
    <View
      // Sits above the gesture bar without hugging it. On a device with no
      // inset this still clears the screen edge by a full gutter.
      style={{ paddingBottom: Math.max(insets.bottom, 12) + 14 }}
      className="absolute inset-x-0 bottom-0 px-gutter"
      pointerEvents="box-none"
    >
      <View
        accessibilityRole="tablist"
        style={shadow.floating}
        className="h-[62px] flex-row items-center justify-around rounded-pill bg-surface px-2"
      >
        {state.routes.map((route, index) => (
          <Tab
            key={route.key}
            routeKey={route.name}
            focused={state.index === index}
            onPress={() => go(index)}
            badge={route.name === "review" ? dueCount : undefined}
          />
        ))}
      </View>
    </View>
  );
}
