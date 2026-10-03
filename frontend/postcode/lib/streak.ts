import type { TaskCompletion } from "@/types/domain";
import { dayKey } from "./utils";

function previousDay(date: string): string {
  return new Date(Date.parse(date + "T12:00:00Z") - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function activityStreak(
  history: TaskCompletion[],
  userId: string,
  now: Date,
): { days: number; completedToday: boolean } {
  const dates = new Set(
    history
      .filter(
        (activity) =>
          activity.userId === userId &&
          (activity.status === "recorded" || activity.status === "approved"),
      )
      .map(
        (activity) =>
          activity.activityDate ??
          (Number.isFinite(Date.parse(activity.completedAt))
            ? dayKey(activity.completedAt)
            : ""),
      ),
  );
  const today = dayKey(now);
  const completedToday = dates.has(today);
  let date = completedToday ? today : previousDay(today);
  let days = 0;
  while (dates.has(date)) {
    days++;
    date = previousDay(date);
  }
  return { days, completedToday };
}
