import { useCallback, useEffect, useState } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Cards, NotePencil, Lightning, User, type Icon as PhosphorIcon } from "phosphor-react-native";
import { raw, shadow } from "@/theme";

/**
 * Floating pill navigation.
 *
 * The active state is a single pill that SLIDES between tabs. Every tab is the
 * same width and nothing about the layout changes when the selection does, so
 * the three tabs you did not touch stay exactly where they were.
 *
 * The earlier version grew the active tab to fit a label. That animated layout
 * rather than a transform, so selecting one tab shoved its neighbours sideways,
 * and the growth itself read as a pop. Sliding a transform costs the siblings
 * nothing and reads as one object moving, which is what a selection is.
 *
 * Labels are gone with it. At four tabs across a pill bar there is not room for
 * a label without either shrinking the touch target or reintroducing the width
 * change. The icons carry it, and every tab still announces its name to a
 * screen reader.
 */

const ICONS: Record<string, { icon: PhosphorIcon; label: string }> = {
  index: { icon: Cards, label: "Decks" },
  pad: { icon: NotePencil, label: "Pad" },
  review: { icon: Lightning, label: "Review" },
  profile: { icon: User, label: "You" },
};

/** Enough damping to settle without a visible bounce. */
const SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;

const BAR_HEIGHT = 62;
const PILL_HEIGHT = 46;
const BAR_PADDING = 8;

function Tab({
  routeKey,
  focused,
  onPress,
  badge,
}: {
  routeKey: string;
  focused: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const entry = ICONS[routeKey];
  const active = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    active.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, active]);

  // Two icons stacked and crossfaded, because Phosphor's weights are different
  // shapes: there is no single glyph to tween between regular and fill.
  const restingStyle = useAnimatedStyle(() => ({ opacity: 1 - active.value }));
  const activeStyle = useAnimatedStyle(() => ({ opacity: active.value }));

  if (!entry) return null;
  const { icon: IconComponent, label } = entry;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-1 items-center justify-center"
      style={{ height: PILL_HEIGHT }}
    >
      <View>
        <Animated.View style={restingStyle}>
          <IconComponent size={23} color={raw.inkFaint} weight="regular" />
        </Animated.View>

        <Animated.View style={activeStyle} className="absolute">
          <IconComponent size={23} color="#FFFFFF" weight="fill" />
        </Animated.View>

        {badge && badge > 0 && !focused ? (
          <View className="absolute -right-1 -top-0.5 h-2 w-2 rounded-pill bg-clay" />
        ) : null}
      </View>
    </Pressable>
  );
}

export interface TabBarProps extends BottomTabBarProps {
  /** Number of flashcards due, shown as a dot on the Review tab. */
  dueCount?: number;
}

export function TabBar({ state, navigation, dueCount = 0 }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [trackWidth, setTrackWidth] = useState(0);

  const count = state.routes.length;
  const tabWidth = count > 0 ? trackWidth / count : 0;
  const offset = useSharedValue(0);

  useEffect(() => {
    if (tabWidth === 0) return;
    offset.value = withSpring(state.index * tabWidth, SPRING);
  }, [state.index, tabWidth, offset]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

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
      // Clears the gesture bar without stacking on top of it.
      style={{ paddingBottom: insets.bottom > 0 ? insets.bottom : 14 }}
      className="absolute inset-x-0 bottom-0 px-gutter"
      pointerEvents="box-none"
    >
      <View
        accessibilityRole="tablist"
        style={[shadow.floating, { height: BAR_HEIGHT, paddingHorizontal: BAR_PADDING }]}
        className="flex-row items-center rounded-pill bg-surface"
      >
        <View onLayout={onLayout} className="flex-1 flex-row items-center">
          {/* Behind the icons, and the only thing that moves. */}
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[indicatorStyle, { width: tabWidth, height: PILL_HEIGHT }]}
              className="absolute left-0 rounded-pill bg-ink"
            />
          ) : null}

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
    </View>
  );
}
