import { type ReactNode } from "react";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";
import { shadow } from "@/theme";
import { Text } from "./text";

/**
 * Bottom sheet built on the platform Modal.
 *
 * No gesture library and no drag-to-dismiss. A sheet that can be dragged has to
 * fight every scrollable thing inside it for the same vertical gesture, and the
 * sheets in this app hold controls rather than long content. Tapping the
 * backdrop and the system back button both close it, which is what people
 * actually reach for on Android.
 */
export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Sheet({ visible, onClose, title, children, className }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Capped against the real window rather than a fixed pixel height. A hard
  // coded cap taller than a small phone's screen pushes the sheet's own
  // scroll area off the bottom, which reads as "it will not scroll".
  const maxHeight = height * 0.85;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
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
          entering={SlideInDown.duration(240)}
          exiting={SlideOutDown.duration(180)}
          style={[shadow.floating, { paddingBottom: insets.bottom + 20, maxHeight }]}
          className={cn("rounded-t-sheet bg-bg px-gutter pt-3", className)}
        >
          <View className="mb-4 h-1 w-9 self-center rounded-pill bg-hairline" />
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
