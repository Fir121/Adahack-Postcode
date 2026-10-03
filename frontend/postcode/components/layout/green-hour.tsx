"use client";

import { createContext, useContext } from "react";
import { Timer } from "lucide-react";
import { useClock } from "@/hooks/use-clock";
import { countdownLabel, greenHourConfig, greenHourWindow } from "@/lib/green-hour";

const inactiveWindow = { active: false, secondsRemaining: 0 };
const GreenHourContext = createContext(inactiveWindow);

export function GreenHourProvider({ children }: { children: React.ReactNode }) {
  const now = useClock(1000, greenHourConfig.enabled);
  const bonus =
    now === null
      ? inactiveWindow
      : greenHourWindow(now);
  return (
    <GreenHourContext.Provider value={bonus.active ? bonus : inactiveWindow}>
      {children}
    </GreenHourContext.Provider>
  );
}

export const useGreenHour = () => useContext(GreenHourContext);

export function GreenHourBanner() {
  const { active, secondsRemaining } = useGreenHour();
  if (!active) return null;
  return (
    <section className="green-hour-banner" aria-label="GreenHour bonus window">
      <h2 className="green-hour-title">
        <span>Green</span>Hour
      </h2>
      <p>
        <strong>Bonus window active</strong> · Tasks are 2× the points for the
        next hour
      </p>
      <div
        className="green-hour-countdown"
        role="timer"
        aria-live="off"
        aria-label="GreenHour time remaining"
      >
        <Timer size={17} aria-hidden="true" />
        <span>{countdownLabel(secondsRemaining)}</span>
      </div>
    </section>
  );
}
