import { Pressable, View } from "react-native";
import type { ReviewGrade } from "@retenit/shared";

import { FlagIcon as Flag } from "phosphor-react-native";

import { Text } from "@/components/ui/text";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { raw } from "@/theme";

/**
 * The finer grades, behind a tap.
 *
 * Most reviews are one of two answers: I knew it, or I did not. Those two live
 * on the card as buttons. Hard and Easy only change how far out the card is
 * pushed, which matters to someone tuning their schedule and is noise to
 * everyone else, so they sit in a list rather than taking up a permanent row.
 *
 * Each option shows when the card would next come back, because that is the
 * only thing the choice actually does.
 */

const OPTIONS: { grade: Exclude<ReviewGrade, "again">; label: string; meaning: string }[] = [
  { grade: "hard", label: "Hard", meaning: "Got there, but it was a struggle" },
  { grade: "good", label: "Good", meaning: "Knew it after a moment" },
  { grade: "easy", label: "Easy", meaning: "Instant, push it well out" },
];

export interface GradeSheetProps {
  visible: boolean;
  onClose: () => void;
  onGrade: (grade: ReviewGrade) => void;
  /** Next interval per grade, e.g. "in 4 days". */
  intervals: Record<ReviewGrade, string>;
  /**
   * Flag the card. Lives here rather than as a second icon on the card,
   * because the icon that opens this sheet is itself a flag and two identical
   * flags meaning different things is worse than one menu holding both.
   * Required for a Play Store GenAI listing.
   */
  onReport?: () => void;
}

export function GradeSheet({
  visible,
  onClose,
  onGrade,
  intervals,
  onReport,
}: GradeSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="How well did you know it?">
      <View className="gap-2">
        {OPTIONS.map((option) => (
          <Pressable
            key={option.grade}
            accessibilityRole="button"
            accessibilityLabel={`${option.label}. ${option.meaning}. Next review ${intervals[option.grade]}.`}
            onPress={() => {
              onClose();
              onGrade(option.grade);
            }}
            className={cn(
              "flex-row items-center justify-between rounded-tile border-[1.5px] bg-surface px-4 py-3.5",
              option.grade === "good" ? "border-ink" : "border-hairline",
            )}
          >
            <View className="flex-1">
              <Text variant="heading">{option.label}</Text>
              <Text variant="caption">{option.meaning}</Text>
            </View>
            <Text variant="label" className="text-ink-faint">
              {intervals[option.grade]}
            </Text>
          </Pressable>
        ))}
      </View>

      {onReport ? (
        <>
          <View className="my-4 h-px bg-hairline" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report this card"
            onPress={() => {
              onClose();
              onReport();
            }}
            className="flex-row items-center gap-3 px-1 py-2"
          >
            <Flag size={18} color={raw.inkMuted} weight="regular" />
            <View className="flex-1">
              <Text variant="subheading">Report this card</Text>
              <Text variant="caption">Wrong, confusing or offensive</Text>
            </View>
          </Pressable>
        </>
      ) : null}
    </Sheet>
  );
}
