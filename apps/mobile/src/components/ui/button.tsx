import { ActivityIndicator, Pressable, View, type PressableProps } from "react-native";
import Animated from "react-native-reanimated";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { cn } from "@/lib/cn";
import { usePressScale } from "@/lib/use-press-scale";
import { raw } from "@/theme";
import { Text } from "./text";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "inverse";
export type ButtonSize = "md" | "lg";

/**
 * Pill buttons throughout, matching the reference screens. Primary is solid ink
 * rather than a brand colour: the deck colours are identity, not interaction,
 * and letting them become buttons would make six different looking primaries.
 */
const CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-ink",
  secondary: "border-[1.5px] border-ink bg-transparent",
  ghost: "bg-transparent",
  destructive: "border-[1.5px] border-danger bg-transparent",
  /** For use on a deck-coloured ground, where `secondary` would be unreadable. */
  inverse: "border-[1.5px] border-ink-inverse bg-transparent",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: "text-ink-inverse",
  secondary: "text-ink",
  ghost: "text-ink",
  destructive: "text-danger",
  inverse: "text-ink-inverse",
};

const ICON_COLOR: Record<ButtonVariant, string> = {
  primary: "#FFFFFF",
  secondary: raw.ink,
  ghost: raw.ink,
  destructive: raw.danger,
  inverse: "#FFFFFF",
};

const SIZE: Record<ButtonSize, string> = {
  md: "h-[46px] px-5",
  lg: "h-[54px] px-6",
};

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: PhosphorIcon;
  /** Fill the available width. Bottom-anchored actions almost always want this. */
  block?: boolean;
  loading?: boolean;
  className?: string;
}

export function Button({
  label,
  variant = "primary",
  size = "lg",
  icon: IconComponent,
  block = true,
  loading = false,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const press = usePressScale({ to: 0.97 });
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={press.style}
      className={cn(
        "flex-row items-center justify-center gap-2 rounded-pill",
        CONTAINER[variant],
        SIZE[size],
        block ? "w-full" : "self-start",
        isDisabled && "opacity-40",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={ICON_COLOR[variant]} />
      ) : (
        <View className="flex-row items-center gap-2">
          {IconComponent ? (
            <IconComponent size={19} color={ICON_COLOR[variant]} weight="regular" />
          ) : null}
          <Text
            variant="subheading"
            className={cn("font-body-sb", LABEL[variant])}
          >
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}
