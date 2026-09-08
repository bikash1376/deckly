import { View } from "react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { raw } from "@/theme";
import { Text } from "./text";
import { Button } from "./button";

export interface EmptyStateProps {
  icon: PhosphorIcon;
  title: string;
  /** Say what to do next, not that something is missing. */
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: IconComponent,
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="items-center px-6 py-12">
      <View className="h-16 w-16 items-center justify-center rounded-tile bg-bg-sunken">
        <IconComponent size={28} color={raw.inkFaint} weight="regular" />
      </View>

      <Text variant="title" className="mt-5 text-center">
        {title}
      </Text>
      <Text variant="body" className="mt-2 max-w-[280px] text-center text-ink-muted">
        {body}
      </Text>

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} block={false} className="mt-6" />
      ) : null}
    </View>
  );
}
