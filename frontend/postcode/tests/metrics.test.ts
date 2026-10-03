import assert from "node:assert/strict";
import { test } from "node:test";
import { apiConfig } from "../lib/api/config";
import {
  getCommunity,
  getCommunities,
  getSupportedPostcodes,
} from "../lib/api/postcodes";
import {
  adaptPostcodeMetric,
  adaptDetailMetric,
  metricProgress,
  metricIndicators,
  getPostcodeMetrics,
} from "../lib/api/metrics";
import { weakestIndicator } from "../lib/tasks";

const coordinate = {
  postcode: "EH9 1AB",
  latitude: 55.935324,
  longitude: -3.175028,
};
const detail = {
  postcode: coordinate.postcode,
  carbon_intensity: 42.5,
  air_quality: 3,
  users: [{ user_id: "a", name: "Alex", points: 12 }],
};
test("postcode metrics join by normalized postcode, preserve full totals and bound scene scores", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  t.mock.method(globalThis, "fetch", async (url: string) =>
    Response.json(
      url.endsWith("/coordinates/")
        ? [coordinate]
        : url.includes("/coordinates/")
          ? coordinate
          : url.endsWith("/metrics/")
            ? [{ postcode: "eh91ab", total_points: 125 }]
            : detail,
    ),
  );
  try {
    const communities = await getCommunities();
    assert.equal(communities[0].progress.score, 100);
    assert.equal(communities[0].progress.totalPoints, 125);
    assert.equal(communities[0].progress.scoreAvailable, true);
    const selected = await getCommunity("eh9-1ab");
    assert.equal(selected.indicators[0].displayValue, "42.5 gCO₂/kWh");
    assert.equal(selected.indicators[1].displayValue, "3 / 10");
    assert.equal(selected.progress.stats[0].value, 125);
    assert.equal(weakestIndicator(selected.indicators), undefined);
  } finally {
    apiConfig.useMock = previous;
  }
});
test("zero carbon values are real values; null and zero AQI remain unavailable without invented status thresholds", () => {
  const indicators = metricIndicators(
    adaptDetailMetric(
      { ...detail, carbon_intensity: 0, air_quality: 0 },
      coordinate.postcode,
    ),
  );
  assert.equal(indicators[0].value, 0);
  assert.equal(indicators[0].displayValue, "0 gCO₂/kWh");
  assert.equal(indicators[1].displayValue, "Unavailable");
  assert.equal(indicators[1].value, undefined);
  assert.equal(
    metricIndicators(
      adaptDetailMetric(
        {
          postcode: coordinate.postcode,
          carbon_intensity: null,
          air_quality: null,
        },
        coordinate.postcode,
      ),
    )[0].displayValue,
    "Unavailable",
  );
  assert.equal(
    metricProgress({ postcode: coordinate.postcode, total_points: 0 })
      .scoreAvailable,
    true,
  );
  assert.equal(
    metricProgress({ postcode: coordinate.postcode, total_points: 0 }).score,
    0,
  );
});
test("missing postcode totals stay pending and metric failures leave coordinates and signup available", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  let fail = false;
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requests.push(url);
    if (url.includes("/coordinates/"))
      return Response.json(
        url.endsWith("/coordinates/") ? [coordinate] : coordinate,
      );
    return fail
      ? Response.json({ message: "Metrics offline" }, { status: 503 })
      : Response.json(url.endsWith("/metrics/") ? [] : detail);
  });
  try {
    assert.equal((await getCommunities())[0].progress.scoreAvailable, false);
    fail = true;
    const selected = await getCommunity("eh9-1ab");
    assert.equal(selected.progress.scoreAvailable, false);
    assert.deepEqual(selected.indicators, []);
    assert.match(selected.dataWarnings!.score!, /Metrics offline/);
    assert.match(selected.dataWarnings!.indicators!, /Metrics offline/);
    const before = requests.length;
    assert.deepEqual(await getSupportedPostcodes(), [coordinate.postcode]);
    assert.equal(requests.length, before + 1);
  } finally {
    apiConfig.useMock = previous;
  }
});
test("invalid/duplicate metrics fail visibly, including wrong postcode and invalid environmental values", async (t) => {
  assert.throws(
    () =>
      adaptPostcodeMetric({ postcode: coordinate.postcode, total_points: -1 }),
    /invalid community points/,
  );
  assert.throws(
    () => adaptDetailMetric(detail, "EH9 1AD"),
    /different postcode/,
  );
  assert.throws(
    () =>
      adaptDetailMetric({ ...detail, air_quality: 11 }, coordinate.postcode),
    /invalid air quality/,
  );
  assert.throws(
    () =>
      adaptDetailMetric(
        { ...detail, carbon_intensity: -2 },
        coordinate.postcode,
      ),
    /invalid electricity/,
  );
  t.mock.method(globalThis, "fetch", async () =>
    Response.json([
      { postcode: "EH9 1AB", total_points: 1 },
      { postcode: "eh91ab", total_points: 2 },
    ]),
  );
  await assert.rejects(getPostcodeMetrics(), /duplicate postcode/);
});
