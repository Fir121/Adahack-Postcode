"use client";

import { useEffect, useState } from "react";

export function useClock(intervalMs = 1000, enabled = true): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const update = () => setNow(Date.now());
    const frame = requestAnimationFrame(update);
    const interval = window.setInterval(update, intervalMs);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [intervalMs, enabled]);
  return now;
}
