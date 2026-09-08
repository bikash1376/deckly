import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/lib/cn";
import { cleanCopy } from "@/lib/copy";

/**
 * Every piece of type in the app goes through here.
 *
 * Two reasons it is not just `<Text className="...">`:
 *  1. The variant is the only way to get a size, so nobody reaches for
 *     `text-[17px]` and quietly invents a step in the scale.
 *  2. String children are run through `cleanCopy`, which is the backstop for
 *     the no em dash, no emoji rule. Hand written strings should already be
 *     clean; model output frequently is not.
 */

export type TextVariant =
  | "hero"
  | "display"
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "bodyLarge"
  | "caption"
  | "label"
  | "overline";

const VARIANT: Record<TextVariant, string> = {
  hero: "font-display text-hero text-ink",
  display: "font-display text-display text-ink",
  title: "font-display text-title text-ink",
  heading: "font-body-sb text-heading text-ink",
  subheading: "font-body-md text-subheading text-ink",
  bodyLarge: "font-body text-body-lg text-ink",
  body: "font-body text-body text-ink",
  caption: "font-body text-caption text-ink-muted",
  label: "font-body-md text-label text-ink",
  overline: "font-body-md text-overline uppercase text-ink-faint",
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  className?: string;
  /**
   * Skip copy sanitising. Only for text that is genuinely not prose: a code
   * block, a raw identifier, a user's own note body echoed back verbatim.
   */
  raw?: boolean;
}

export function Text({
  variant = "body",
  className,
  raw = false,
  children,
  ...rest
}: TextProps) {
  const content =
    !raw && typeof children === "string" ? cleanCopy(children) : children;

  return (
    <RNText className={cn(VARIANT[variant], className)} {...rest}>
      {content}
    </RNText>
  );
}
