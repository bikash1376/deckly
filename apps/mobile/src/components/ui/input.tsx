import { forwardRef } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { cn } from "@/lib/cn";
import { raw } from "@/theme";
import { Text } from "./text";

export interface InputProps extends TextInputProps {
  label?: string;
  /** Shown under the field. Says what went wrong and how to fix it. */
  error?: string;
  hint?: string;
  className?: string;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, className, containerClassName, multiline, ...rest },
  ref,
) {
  return (
    <View className={cn("gap-2", containerClassName)}>
      {label ? <Text variant="overline">{label}</Text> : null}

      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={raw.inkFaint}
        selectionColor={raw.clay}
        cursorColor={raw.clay}
        textAlignVertical={multiline ? "top" : "center"}
        className={cn(
          "rounded-tile border-[1.5px] bg-surface px-4 font-body text-body-lg text-ink",
          multiline ? "min-h-[120px] py-4" : "h-[54px]",
          error ? "border-danger" : "border-hairline",
          className,
        )}
        {...rest}
      />

      {error ? (
        <Text variant="caption" className="text-danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
});
