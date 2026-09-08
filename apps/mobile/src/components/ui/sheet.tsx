import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import BottomSheet, {
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
 * gestures do not reach handlers inside a Modal unless its content is wrapped
 * in its own GestureHandlerRootView. The drag silently did nothing, which is
 * the failure this replaces.
 *
 * This library does not use RN's Modal at all. It renders through its own
 * portal inside the existing gesture root, so the drag, the momentum, the
 * backdrop fade and the interaction between the sheet's own scrolling and the
 * pan all work without the Modal boundary in the way.
 *
 * The component API is unchanged, so nothing calling it had to move.
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
  const ref = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  // Index -1 is dismissed. Reporting it lets the parent's `visible` follow a
  // drag or a backdrop tap, rather than only a button press.
  const onChange = useCallback(
    (index: number) => {
      if (index === -1) onClose();
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

  const style = useMemo(() => ({ backgroundColor: raw.bg }), []);
  const handleStyle = useMemo(() => ({ backgroundColor: raw.hairline, width: 36 }), []);

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
      backgroundStyle={style}
      handleIndicatorStyle={handleStyle}
    >
      <BottomSheetView
        style={{ paddingBottom: insets.bottom + 20 }}
        className={cn("px-gutter pt-1", className)}
      >
        {title ? (
          <Text variant="heading" className="mb-4">
            {title}
          </Text>
        ) : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

/**
 * Scrollable sheet content.
 *
 * A plain ScrollView inside a sheet fights the sheet's own pan for the same
 * vertical gesture. This one is aware of the sheet: it scrolls when there is
 * content left to scroll, and hands the gesture back to the sheet at the top.
 */
export function SheetScrollView({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <BottomSheetScrollView showsVerticalScrollIndicator={false} className={className}>
      {children}
    </BottomSheetScrollView>
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

export type { BottomSheet };
