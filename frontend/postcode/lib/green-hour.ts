export const greenHourConfig = {
  enabled: process.env.NEXT_PUBLIC_GREEN_HOUR_ENABLED === "true",
  startAt: process.env.NEXT_PUBLIC_GREEN_HOUR_START_AT ?? "",
};

export function greenHourWindow(
  now: number,
  config = greenHourConfig,
): { active: boolean; secondsRemaining: number } {
  // Require an explicit timezone so every browser shares the same window.
  const start = /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(config.startAt)
    ? Date.parse(config.startAt)
    : NaN;
  const end = start + 3_600_000;
  const active =
    config.enabled && Number.isFinite(start) && now >= start && now < end;
  return {
    active,
    secondsRemaining: active ? Math.ceil((end - now) / 1000) : 0,
  };
}

export function greenHourPoints(points: number, now = Date.now()): number {
  return points * (greenHourWindow(now).active ? 2 : 1);
}

export function countdownLabel(seconds: number): string {
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
