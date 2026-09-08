import { Pressable, View } from "react-native";
import type { ReviewGrade } from "@retenit/shared";

import { Text } from "@/components/ui/text";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";

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
}

export function GradeSheet({ visible, onClose, onGrade, intervals }: GradeSheetProps) {
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
    </Sheet>
  );
}
