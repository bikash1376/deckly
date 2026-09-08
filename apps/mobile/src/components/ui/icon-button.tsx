import { Pressable } from "react-native";
import Animated from "react-native-reanimated";
import type { Icon as PhosphorIcon, IconWeight } from "phosphor-react-native";
import { cn } from "@/lib/cn";
import { usePressScale } from "@/lib/use-press-scale";
import { raw, shadow } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type IconButtonTone = "surface" | "sunken" | "ink" | "bare";

const TONE: Record<IconButtonTone, { container: string; icon: string; lifted: boolean }> = {
  /** Floating white circle, as on the reference screens. */
  surface: { container: "bg-surface", icon: raw.ink, lifted: true },
  sunken: { container: "bg-bg-sunken", icon: raw.ink, lifted: false },
  ink: { container: "bg-ink", icon: "#FFFFFF", lifted: true },
  bare: { container: "bg-transparent", icon: raw.ink, lifted: false },
};

const SIZE = { sm: 36, md: 44, lg: 52 } as const;
const GLYPH = { sm: 17, md: 20, lg: 24 } as const;

export interface IconButtonProps {
  icon: PhosphorIcon;
  /** Required. An icon with no label is invisible to a screen reader. */
  accessibilityLabel: string;
  onPress?: () => void;
  tone?: IconButtonTone;
  size?: keyof typeof SIZE;
  weight?: IconWeight;
  disabled?: boolean;
  className?: string;
}

export function IconButton({
  icon: IconComponent,
  accessibilityLabel,
  onPress,
  tone = "surface",
  size = "md",
  weight = "regular",
  disabled,
  className,
}: IconButtonProps) {
  const press = usePressScale({ to: 0.92 });
  const t = TONE[tone];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[press.style, t.lifted ? shadow.card : null, { width: SIZE[size], height: SIZE[size] }]}
      className={cn(
        "items-center justify-center rounded-pill",
        t.container,
        disabled && "opacity-40",
        className,
      )}
    >
      <IconComponent size={GLYPH[size]} color={t.icon} weight={weight} />
    </AnimatedPressable>
  );
}
