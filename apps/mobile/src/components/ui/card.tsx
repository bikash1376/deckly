import { Pressable, View, type ViewProps } from "react-native";
import Animated from "react-native-reanimated";
import { cn } from "@/lib/cn";
import { usePressScale } from "@/lib/use-press-scale";
import { shadow } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Not everything is a card. Border, fill and shadow each say "separate object",
 * so `elevated` is the exception rather than the default: use it for something
 * that genuinely lifts off the page, and `flat` for grouping inside a screen
 * that already has plenty of white.
 */
export type CardTone = "elevated" | "flat" | "outlined" | "sunken";

const TONE: Record<CardTone, string> = {
  elevated: "bg-surface",
  flat: "bg-surface",
  outlined: "bg-surface border-[1.5px] border-hairline",
  sunken: "bg-surface-alt",
};

export interface CardProps extends ViewProps {
  tone?: CardTone;
  className?: string;
}

export function Card({ tone = "elevated", className, style, ...rest }: CardProps) {
  return (
    <View
      className={cn("rounded-card", TONE[tone], className)}
      style={[tone === "elevated" ? shadow.card : null, style]}
      {...rest}
    />
  );
}

export interface PressableCardProps extends CardProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function PressableCard({
  tone = "elevated",
  className,
  style,
  onPress,
  disabled,
  accessibilityLabel,
  children,
  ...rest
}: PressableCardProps) {
  const press = usePressScale({ to: 0.98 });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[press.style, tone === "elevated" ? shadow.card : null, style]}
      className={cn("rounded-card", TONE[tone], disabled && "opacity-50", className)}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
