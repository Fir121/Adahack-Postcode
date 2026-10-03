import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countdownLabel,
  greenHourConfig,
  greenHourPoints,
  greenHourWindow,
} from "../lib/green-hour";

test("GreenHour has one shared hour and excludes times before and at expiry", () => {
  const config = { enabled: true, startAt: "2026-10-03T14:00:00+01:00" };
  const start = Date.parse(config.startAt);
  assert.deepEqual(greenHourWindow(start - 1, config), {
    active: false,
    secondsRemaining: 0,
  });
  assert.deepEqual(greenHourWindow(start, config), {
    active: true,
    secondsRemaining: 3600,
  });
  assert.deepEqual(greenHourWindow(start + 3_599_999, config), {
    active: true,
    secondsRemaining: 1,
  });
  assert.deepEqual(greenHourWindow(start + 3_600_000, config), {
    active: false,
    secondsRemaining: 0,
  });
  assert.equal(countdownLabel(3600), "01:00:00");
  assert.equal(countdownLabel(1799), "00:29:59");
});

test("disabled or invalid configuration never advertises bonus points", () => {
  const now = Date.parse("2026-10-03T13:30:00Z");
  for (const startAt of [
    "",
    "invalid",
    "2026-10-03T13:00:00",
    "2026-10-03T99:00:00Z",
  ])
    assert.equal(
      greenHourWindow(now, { enabled: true, startAt }).active,
      false,
    );
  assert.equal(
    greenHourWindow(now, { enabled: false, startAt: "2026-10-03T13:00:00Z" })
      .active,
    false,
  );
});

test("new points double only inside the configured window", () => {
  const previous = { ...greenHourConfig };
  try {
    Object.assign(greenHourConfig, {
      enabled: true,
      startAt: "2026-10-03T13:00:00Z",
    });
    assert.equal(greenHourPoints(3, Date.parse("2026-10-03T13:30:00Z")), 6);
    assert.equal(greenHourPoints(0, Date.parse("2026-10-03T13:30:00Z")), 0);
    assert.equal(greenHourPoints(3, Date.parse("2026-10-03T14:00:00Z")), 3);
  } finally {
    Object.assign(greenHourConfig, previous);
  }
});
