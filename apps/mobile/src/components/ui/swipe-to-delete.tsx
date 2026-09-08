import { type ReactNode, useCallback, useRef } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
  interpolate,
} from "react-native-reanimated";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import { Trash } from "phosphor-react-native";

import { Text } from "./text";
import { useConfirm } from "./confirm";

/**
 * Swipe a row left to reveal delete.
 *
 * The swipe reveals the action, it does not perform it: a list item that
 * vanishes because a thumb brushed past it is how people lose work. Tapping
 * the revealed button then asks once, because deleting a note takes away
 * something the user wrote and there is no undo.
 */
export interface SwipeToDeleteProps {
  onDelete: () => void;
  /** Named in the prompt, so the question is about a specific thing. */
  itemName: string;
  /** What is actually lost. Say it plainly. */
  consequence?: string;
  children: ReactNode;
}

const ACTION_WIDTH = 88;

export function SwipeToDelete({
  onDelete,
  itemName,
  consequence,
  children,
}: SwipeToDeleteProps) {
  const swipeable = useRef<SwipeableMethods>(null);
  const ask = useConfirm();

  const confirm = useCallback(async () => {
    const ok = await ask({
      title: `Delete ${itemName}?`,
      body: consequence ?? "This cannot be undone.",
      destructive: true,
    });
    // Closes either way. Cancelling and leaving the row open gives no way back
    // out but another swipe.
    swipeable.current?.close();
    if (ok) onDelete();
  }, [ask, itemName, consequence, onDelete]);

  const renderRight = useCallback(
    (_progress: SharedValue<number>, translation: SharedValue<number>) => (
      <DeleteAction translation={translation} onPress={confirm} />
    ),
    [confirm],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={renderRight}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

function DeleteAction({
  translation,
  onPress,
}: {
  translation: SharedValue<number>;
  onPress: () => void;
}) {
  // The label fades in as the row opens, so a half swipe reads as a hint
  // rather than a fully armed button.
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(translation.value, [-ACTION_WIDTH, -ACTION_WIDTH / 3, 0], [1, 0.6, 0]),
  }));

  return (
    <Animated.View style={style} className="justify-center pl-2.5">
      <View
        onTouchEnd={onPress}
        accessibilityRole="button"
        accessibilityLabel="Delete"
        className="h-full items-center justify-center gap-1 rounded-card bg-danger px-5"
        style={{ width: ACTION_WIDTH }}
      >
        <Trash size={20} color="#FFFFFF" weight="regular" />
        <Text variant="label" className="text-ink-inverse">
          Delete
        </Text>
      </View>
    </Animated.View>
  );
}
