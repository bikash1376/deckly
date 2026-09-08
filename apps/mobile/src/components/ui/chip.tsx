import { Pressable, View } from "react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { cn } from "@/lib/cn";
import { raw, type DeckColorKey } from "@/theme";
import { Text } from "./text";

/**
 * Small status and metadata pills. A chip labels something; it is not a button
 * unless `onPress` is given, and it never carries a primary action.
 */
export type ChipTone = "neutral" | "outline" | "amber" | "danger" | "success" | DeckColorKey;

const TONE: Record<string, { container: string; label: string; icon: string }> = {
  neutral: { container: "bg-bg-sunken", label: "text-ink-muted", icon: raw.inkMuted },
  outline: { container: "bg-surface border border-hairline", label: "text-ink", icon: raw.ink },
  amber: { container: "bg-amber-tint", label: "text-ink", icon: raw.amber },
  danger: { container: "bg-danger-tint", label: "text-danger", icon: raw.danger },
  success: { container: "bg-surface-alt", label: "text-success", icon: raw.success },
  clay: { container: "bg-clay-tint", label: "text-clay", icon: raw.clay },
  slate: { container: "bg-slate-tint", label: "text-slate", icon: raw.slate },
  sage: { container: "bg-sage-tint", label: "text-sage", icon: raw.sage },
  mocha: { container: "bg-mocha-tint", label: "text-mocha", icon: raw.mocha },
  eucalyptus: {
    container: "bg-eucalyptus-tint",
    label: "text-eucalyptus",
    icon: raw.eucalyptus,
  },
  plum: { container: "bg-plum-tint", label: "text-plum", icon: raw.plum },
};

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  icon?: PhosphorIcon;
  onPress?: () => void;
  className?: string;
}

export function Chip({ label, tone = "neutral", icon: IconComponent, onPress, className }: ChipProps) {
  const t = TONE[tone] ?? TONE.neutral;

  const body = (
    <View
      className={cn(
        "h-[30px] flex-row items-center gap-1.5 self-start rounded-pill px-3",
        t.container,
        className,
      )}
    >
      {IconComponent ? <IconComponent size={14} color={t.icon} weight="regular" /> : null}
      <Text variant="label" className={t.label}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {body}
    </Pressable>
  );
}
