import type { IndicatorStatus } from "@/types/domain";

export function normalizeScore(value: number, max = 100): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, (value / max) * 100)));
}

export function greenLevel(score: number): number {
  return Math.min(5, Math.floor(normalizeScore(score) / 20));
}

export const indicatorStatus: Record<
  IndicatorStatus,
  { label: string; className: string; rank: number }
> = {
  unknown: { label: "Unavailable", className: "status-unknown", rank: 4 },
  poor: { label: "Needs a little love", className: "status-poor", rank: 0 },
  fair: { label: "Room to grow", className: "status-fair", rank: 1 },
  good: { label: "Doing well", className: "status-good", rank: 2 },
  excellent: { label: "Thriving", className: "status-excellent", rank: 3 },
};
