import assert from "node:assert/strict";
import { test } from "node:test";
import { activityStreak } from "../lib/streak";
import type { TaskCompletion } from "../types/domain";

function action(
  date: string,
  overrides: Partial<TaskCompletion> = {},
): TaskCompletion {
  return {
    id: date,
    userId: "me",
    communityId: "home",
    taskId: "1",
    taskTitle: "Walk",
    category: "Community",
    targetIndicators: [],
    activityDate: date,
    completedAt: date + "T12:00:00Z",
    status: "recorded",
    ...overrides,
  };
}

test("streak counts consecutive unique days, not tasks, and retains yesterday until today ends", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const history = [
    action("2026-10-02"),
    action("2026-10-01"),
    action("2026-10-02", { taskId: "2" }),
  ];
  assert.deepEqual(activityStreak(history, "me", now), {
    days: 2,
    completedToday: false,
  });
  assert.deepEqual(
    activityStreak([...history, action("2026-10-03")], "me", now),
    { days: 3, completedToday: true },
  );
  assert.deepEqual(
    activityStreak(history, "me", new Date("2026-10-03T23:00:00Z")),
    { days: 0, completedToday: false },
  );
});

test("streak stops at gaps, ignores other users, future dates and unapproved actions", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const history = [
    action("2026-10-03"),
    action("2026-10-01"),
    action("2026-10-02", { userId: "other" }),
    action("2026-10-02", { status: "rejected" }),
    action("2026-10-02", { status: "pending" }),
    action("2026-10-04"),
  ];
  assert.deepEqual(activityStreak(history, "me", now), {
    days: 1,
    completedToday: true,
  });
  assert.deepEqual(activityStreak([], "me", now), {
    days: 0,
    completedToday: false,
  });
});

test("London dates cross midnight and DST; dated API records override timestamp placeholders", () => {
  const history = [
    action("2026-03-30"),
    action("2026-03-29"),
    action("2026-03-28"),
    action("2026-03-27"),
  ];
  assert.deepEqual(
    activityStreak(history, "me", new Date("2026-03-29T23:00:00Z")),
    { days: 4, completedToday: true },
  );
  const autumn = [
    action("2026-10-25"),
    action("2026-10-24"),
    action("2026-10-23"),
  ];
  assert.equal(
    activityStreak(autumn, "me", new Date("2026-10-25T12:00:00Z")).days,
    3,
  );
  assert.equal(
    activityStreak(
      [action("2026-10-03", { completedAt: "2026-10-05T12:00:00Z" })],
      "me",
      new Date("2026-10-03T12:00:00Z"),
    ).days,
    1,
  );
  assert.equal(
    activityStreak(
      [
        action("", {
          activityDate: undefined,
          completedAt: "2026-10-02T23:30:00Z",
          status: "approved",
        }),
      ],
      "me",
      new Date("2026-10-03T12:00:00Z"),
    ).days,
    1,
  );
});
