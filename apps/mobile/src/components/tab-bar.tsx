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
import {
  CardsIcon as Cards,
  NotePencilIcon as NotePencil,
  LightningIcon as Lightning,
  UserIcon as User,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { raw, shadow } from "@/theme";
import { Text } from "./ui/text";

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
 * The pill hugs whatever it is over rather than filling a fixed slot, so the
 * space around "Pad" looks the same as the space around "Review" instead of a
 * short word floating in a wide box. It can animate its own width freely
 * because it is absolutely positioned: nothing else reflows when it changes.
 *
 * Every tab reserves room for its label at all times, visible only on the
 * active one. That is what keeps the slots from resizing as the selection
 * moves, and it is why measuring each tab once is enough.
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

/**
 * Derived, not chosen.
 *
 * The pill is centred in the bar, so it clears the top and bottom by half the
 * leftover height. Setting the horizontal inset to the same number makes the
 * gap beside the outermost pill match the gap above it, and keeps them matched
 * if either height ever changes.
 */
const BAR_PADDING = (BAR_HEIGHT - PILL_HEIGHT) / 2;

/** The breathing room inside the pill, identical on every tab. */
const TAB_PADDING = 12;

function Tab({
  routeKey,
  focused,
  onPress,
  onLayout,
  badge,
}: {
  routeKey: string;
  focused: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
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
  const labelStyle = useAnimatedStyle(() => ({ opacity: active.value }));

  if (!entry) return null;
  const { icon: IconComponent, label } = entry;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={onLayout}
      className="flex-row items-center justify-center gap-1.5"
      style={{ height: PILL_HEIGHT, paddingHorizontal: TAB_PADDING }}
    >
      <View>
        <Animated.View style={restingStyle}>
          <IconComponent size={22} color={raw.inkFaint} weight="regular" />
        </Animated.View>

        <Animated.View style={activeStyle} className="absolute">
          <IconComponent size={22} color="#FFFFFF" weight="fill" />
        </Animated.View>

        {badge && badge > 0 && !focused ? (
          <View className="absolute -right-1 -top-0.5 h-2 w-2 rounded-pill bg-clay" />
        ) : null}
      </View>

      {/* Always laid out, faded out when inactive. Mounting it only on the
          active tab would resize that tab and shove its neighbours, which is
          the exact behaviour this rewrite exists to remove. */}
      <Animated.View style={labelStyle} pointerEvents="none">
        <Text variant="label" numberOfLines={1} className="font-body-sb text-ink-inverse">
          {label}
        </Text>
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

  // Measured per tab, because each label is a different width and the pill
  // matches whatever it is sitting on.
  const [slots, setSlots] = useState<Record<number, { x: number; width: number }>>({});

  const offset = useSharedValue(0);
  const width = useSharedValue(0);

  const target = slots[state.index];

  useEffect(() => {
    if (!target) return;
    offset.value = withSpring(target.x, SPRING);
    width.value = withSpring(target.width, SPRING);
  }, [target, offset, width]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
    width: width.value,
  }));

  const measure = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      const { x, width: w } = event.nativeEvent.layout;
      setSlots((previous) => {
        const known = previous[index];
        if (known && known.x === x && known.width === w) return previous;
        return { ...previous, [index]: { x, width: w } };
      });
    },
    [],
  );

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
        {/* Between, so the outermost pills sit exactly BAR_PADDING from the
            bar's edges: the same distance they sit from its top. Even spacing
            pushed them further in than that and broke the symmetry. */}
        <View className="flex-1 flex-row items-center justify-between">
          {/* Behind the icons, and the only thing that moves. */}
          {target ? (
            <Animated.View
              pointerEvents="none"
              style={[indicatorStyle, { height: PILL_HEIGHT }]}
              className="absolute left-0 rounded-pill bg-ink"
            />
          ) : null}

          {state.routes.map((route, index) => (
            <Tab
              key={route.key}
              routeKey={route.name}
              focused={state.index === index}
              onPress={() => go(index)}
              onLayout={measure(index)}
              badge={route.name === "review" ? dueCount : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
