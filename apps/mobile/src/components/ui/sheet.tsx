import { type ReactNode, useEffect } from "react";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";
import { shadow } from "@/theme";
import { Text } from "./text";

/**
 * Bottom sheet built on the platform Modal.
 *
 * Drag the handle down to dismiss, tap the backdrop, or press system back.
 * The drag is bound to the handle area rather than the whole sheet, because a
 * pan on the body would fight every scroll view inside it for the same vertical
 * gesture, and losing that fight makes a list feel sticky.
 */
export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Past this, releasing dismisses rather than springing back. */
const DISMISS_DISTANCE = 90;
const DISMISS_VELOCITY = 800;

export function Sheet({ visible, onClose, title, children, className }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Capped against the real window rather than a fixed pixel height. A hard
  // coded cap taller than a small phone's screen pushes the sheet's own
  // scroll area off the bottom, which reads as "it will not scroll".
  const maxHeight = height * 0.85;

  const translateY = useSharedValue(0);

  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const drag = Gesture.Pan()
    .onChange((event) => {
      // Downwards only. Dragging up should not lift the sheet off its edge.
      translateY.value = Math.max(0, translateY.value + event.changeY);
    })
    .onEnd((event) => {
      const shouldClose =
        translateY.value > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;

      if (shouldClose) {
        translateY.value = withTiming(height, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 260 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(140)}
          className="absolute inset-0 bg-ink/40"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="flex-1"
          />
        </Animated.View>

        <Animated.View
          style={[sheetStyle, shadow.floating, { paddingBottom: insets.bottom + 20, maxHeight }]}
          className={cn("rounded-t-sheet bg-bg px-gutter pt-3", className)}
        >
          <GestureDetector gesture={drag}>
            {/* Padded well beyond the visible bar so the grab area is a real
                target rather than a 4pt line. */}
            <View className="-mx-gutter items-center px-gutter pb-3 pt-1">
              <View className="h-1 w-9 rounded-pill bg-hairline" />
            </View>
          </GestureDetector>

          {title ? (
            <Text variant="heading" className="mb-4">
              {title}
            </Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** A labelled row of choices. Used throughout the pad settings. */
export function SheetRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-5">
      <Text variant="overline" className="mb-2">
        {label}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" className="mt-2">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
