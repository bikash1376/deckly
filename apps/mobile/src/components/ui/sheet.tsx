import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";
import { raw } from "@/theme";
import { Text } from "./text";

/**
 * Bottom sheet, built on @gorhom/bottom-sheet.
 *
 * The hand rolled version put a Pan gesture inside a React Native Modal, and
 * gesture handlers do not receive events inside a Modal unless its content is
 * wrapped in its own GestureHandlerRootView, so the drag silently did nothing.
 * This library renders through its own portal inside the existing gesture root
 * instead, with no Modal boundary in the way.
 */
export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Content taller than the sheet. Changes how the content is mounted, not
   * just its styling, so it has to be declared rather than detected.
   */
  scrollable?: boolean;
  children: ReactNode;
  className?: string;
}

export function Sheet({
  visible,
  onClose,
  title,
  scrollable = false,
  children,
  className,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const ref = useRef<BottomSheetModal>(null);

  /**
   * Whether this sheet has actually opened yet.
   *
   * `onChange` fires with -1 for "closed", including while the sheet is still
   * settling into its first position. Treating that as a dismissal called
   * onClose immediately, the parent set visible back to false, and the sheet
   * shut before it ever appeared: the button looked dead.
   */
  const opened = useRef(false);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      opened.current = false;
      ref.current?.dismiss();
    }
  }, [visible]);

  const onChange = useCallback(
    (index: number) => {
      if (index >= 0) {
        opened.current = true;
        return;
      }
      // Only a close that follows a real open, so a drag or a backdrop tap
      // still keeps the parent's state in step.
      if (opened.current) {
        opened.current = false;
        onClose();
      }
    },
    [onClose],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  const background = useMemo(() => ({ backgroundColor: raw.bg }), []);
  const handle = useMemo(() => ({ backgroundColor: raw.hairline, width: 36 }), []);
  const padding = useMemo(() => ({ paddingBottom: insets.bottom + 20 }), [insets.bottom]);

  const header = title ? (
    <Text variant="heading" className="mb-4">
      {title}
    </Text>
  ) : null;

  return (
    <BottomSheetModal
      ref={ref}
      onChange={onChange}
      // Sized to its content rather than a fixed snap point, so a short sheet
      // does not leave half a screen of empty ground beneath it.
      enableDynamicSizing
      maxDynamicContentSize={height * 0.85}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={background}
      handleIndicatorStyle={handle}
    >
      {/* The scrollable variant mounts BottomSheetScrollView as the direct
          child. Nested inside a BottomSheetView it has no intrinsic height
          under dynamic sizing and collapses to nothing, which looks exactly
          like a sheet that refuses to open. */}
      {scrollable ? (
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={padding}
          className={cn("px-gutter pt-1", className)}
        >
          {header}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={padding} className={cn("px-gutter pt-1", className)}>
          {header}
          {children}
        </BottomSheetView>
      )}
    </BottomSheetModal>
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
