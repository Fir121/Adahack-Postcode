"use client";

import { Flame } from "lucide-react";
import { useHistory } from "@/hooks/queries";
import { useClock } from "@/hooks/use-clock";
import { activityStreak } from "@/lib/streak";

export function ActivityStreak({ userId }: { userId: string }) {
  const history = useHistory(userId);
  const now = useClock(30_000);
  if (history.isPending || now === null)
    return (
      <p className="streak-note" role="status">
        Loading your streak…
      </p>
    );
  if (history.isError)
    return (
      <p className="streak-note">
        Streak couldn&apos;t load.{" "}
        <button
          className="text-button"
          onClick={() => {
            void history.refetch();
          }}
        >
          Try again
        </button>
      </p>
    );
  const streak = activityStreak(history.data, userId, new Date(now));
  return (
    <div className={`activity-streak ${streak.days ? "streak-active" : ""}`}>
      {streak.days > 0 && <Flame size={24} aria-hidden="true" />}
      <div>
        <strong>
          {streak.days ? `${streak.days}-day streak` : "Start your streak"}
        </strong>
        <p>
          {streak.completedToday
            ? "You’ve kept it growing today."
            : streak.days
              ? "Complete an action today to keep it going."
              : "Complete an action every day to build a streak."}
        </p>
      </div>
    </div>
  );
}
