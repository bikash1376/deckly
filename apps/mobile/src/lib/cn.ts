/**
 * Join class names, dropping falsy values.
 *
 * No tailwind-merge here on purpose. On the web that library resolves conflicts
 * between competing utilities; in this app the variant maps below are written so
 * conflicts do not arise, and pulling in a 6kb resolver to paper over sloppy
 * class composition would be the wrong trade.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
