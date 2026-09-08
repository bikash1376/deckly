import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { Text } from "./text";
import { Button } from "./button";
import { shadow } from "@/theme";

/**
 * Confirmation dialogs in the app's own design.
 *
 * `Alert.alert` renders the platform dialog, which on Android arrives in
 * Material styling with its own typeface, corner radius and button treatment.
 * It is the one surface in the app that looks like it belongs to a different
 * product, and it shows up at exactly the wrong moment: when someone is about
 * to destroy something and wants to feel they are still in the same place.
 *
 * Exposed as a promise so a call site reads like a question rather than a
 * callback tree:
 *
 *   if (await confirm({ title: "Delete this note?", destructive: true })) ...
 */

export interface ConfirmOptions {
  title: string;
  /** What actually happens. Say it plainly; this is where trust is won. */
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Resolver = (confirmed: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(
  null,
);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<Resolver | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    setOptions(null);
    resolver.current?.(confirmed);
    resolver.current = null;
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}

      <Modal
        visible={options !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        // The system back button resolves as cancel rather than leaving the
        // promise hanging forever.
        onRequestClose={() => settle(false)}
      >
        <View className="flex-1 items-center justify-center px-8">
          <Animated.View
            entering={FadeIn.duration(140)}
            exiting={FadeOut.duration(120)}
            className="absolute inset-0 bg-ink/45"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => settle(false)}
              className="flex-1"
            />
          </Animated.View>

          {options ? (
            <DialogBody>
              <Text variant="title">{options.title}</Text>
              {options.body ? (
                <Text variant="body" className="mt-2 text-ink-muted">
                  {options.body}
                </Text>
              ) : null}

              <View className="mt-6 gap-2.5">
                <Button
                  label={options.confirmLabel ?? (options.destructive ? "Delete" : "Confirm")}
                  variant={options.destructive ? "destructive" : "primary"}
                  onPress={() => settle(true)}
                />
                <Button
                  label={options.cancelLabel ?? "Cancel"}
                  variant="secondary"
                  onPress={() => settle(false)}
                />
              </View>
            </DialogBody>
          ) : null}
        </View>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/**
 * A calm entrance.
 *
 * The previous version combined `.duration()` with `.springify()`, which are
 * two different animations arguing over the same value: the spring overshoots,
 * the duration clips it, and the result wobbles. This is a short scale from
 * 0.94 with an eased curve, so the dialog appears rather than bounces. A
 * confirmation is not a moment for personality.
 */
function DialogBody({ children }: { children: ReactNode }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  return (
    <Animated.View
      style={[style, shadow.floating]}
      className="w-full rounded-sheet bg-surface p-6"
    >
      {children}
    </Animated.View>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside ConfirmProvider");
  return confirm;
}
