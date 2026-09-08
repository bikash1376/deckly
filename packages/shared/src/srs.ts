import type { ReviewGrade } from "./domain";

/**
 * SM-2 lite.
 *
 * The server owns the real schedule and is the only thing that writes it. The
 * app runs the same function so the flashcard screen can say "next review in
 * 4 days" the instant a grade is tapped, instead of after a round trip.
 *
 * That only holds while there is exactly one implementation, which is why this
 * lives in the shared package: two copies would drift, and the drift would show
 * up as a predicted interval that quietly disagrees with the real one.
 *
 * Departures from textbook SM-2, all deliberate:
 *  · four grades, not six. Nobody tired at 11pm makes a six way distinction.
 *  · `again` resets the interval but only partly decays ease, so one bad night
 *    does not bury a card the user actually knows.
 *  · intervals are capped at a year. Beyond that the scheduling is theatre.
 */

export interface SrsState {
  /** Ease factor. Textbook SM-2 floor is 1.3 and that floor is load bearing. */
  ease: number;
  /** Days until the next review. */
  interval: number;
  /** Consecutive successful reviews. Resets to 0 on `again`. */
  streak: number;
  lapses: number;
}

export const INITIAL_SRS: SrsState = { ease: 2.5, interval: 0, streak: 0, lapses: 0 };

const EASE_DELTA: Record<ReviewGrade, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

const MAX_INTERVAL_DAYS = 365;

export function schedule(state: SrsState, grade: ReviewGrade): SrsState {
  const ease = clamp(state.ease + EASE_DELTA[grade], 1.3, 2.8);

  if (grade === "again") {
    return {
      ease,
      // Same day retry rather than 0, so the card comes back in this session.
      interval: 0,
      streak: 0,
      lapses: state.lapses + 1,
    };
  }

  const streak = state.streak + 1;
  let interval: number;

  if (streak === 1) {
    interval = grade === "easy" ? 3 : 1;
  } else if (streak === 2) {
    interval = grade === "easy" ? 8 : grade === "hard" ? 3 : 6;
  } else {
    const multiplier = grade === "hard" ? 1.2 : grade === "easy" ? ease * 1.3 : ease;
    interval = Math.round(state.interval * multiplier);
  }

  return {
    ease,
    interval: clamp(interval, 1, MAX_INTERVAL_DAYS),
    streak,
    lapses: state.lapses,
  };
}

/** Human readable prediction for the button hints on the flashcard screen. */
export function describeInterval(days: number): string {
  if (days <= 0) return "later today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return weeks === 1 ? "in a week" : `in ${weeks} weeks`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return months === 1 ? "in a month" : `in ${months} months`;
  }
  return "in a year";
}

/** What each button will do, so the user can see the cost before tapping. */
export function previewGrades(state: SrsState): Record<ReviewGrade, string> {
  return {
    again: describeInterval(schedule(state, "again").interval),
    hard: describeInterval(schedule(state, "hard").interval),
    good: describeInterval(schedule(state, "good").interval),
    easy: describeInterval(schedule(state, "easy").interval),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
