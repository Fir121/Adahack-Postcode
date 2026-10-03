import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { apiConfig } from "../lib/api/config";
import { ApiError } from "../lib/api/client";
import {
  getCommunityLeaderboard,
  leaderboardFromMetric,
} from "../lib/api/leaderboard";
import { proxyApiRequest } from "../lib/api/proxy";
import { mockLeaderboard } from "../lib/mock/leaderboard";
import { mockLogin, mockLogout, mockCompleteTask } from "../lib/mock/backend";
import { readDatabase, writeDatabase } from "../lib/mock/store";
import { demoInfo } from "../lib/mock/fixtures";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});
beforeEach(() => storage.clear());
const users = [
  { user_id: "a", name: "Alex", points: 12 },
  { user_id: "b", name: "Jamie", points: 12 },
  { user_id: "c", name: "Casey", points: 0 },
];
test("leaderboard uses postcode metrics and ranks real member points with competition ties", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.ok(url.endsWith("/metrics/EH9%201AB"));
    return Response.json({ postcode: "EH9 1AB", users });
  });
  try {
    const result = await getCommunityLeaderboard("eh91ab");
    assert.equal(result.source, "api");
    assert.equal(result.available, true);
    assert.deepEqual(
      result.entries.map((entry) => [entry.userId, entry.rank, entry.points]),
      [
        ["a", 1, 12],
        ["b", 1, 12],
        ["c", 3, 0],
      ],
    );
  } finally {
    apiConfig.useMock = previous;
  }
});
test("metrics rankings distinguish omitted users, empty rankings, and failed requests", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  try {
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ postcode: "EH9 1AB" }),
    );
    assert.equal((await getCommunityLeaderboard("EH9 1AB")).available, false);
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ postcode: "EH9 1AB", users: [] }),
    );
    const empty = await getCommunityLeaderboard("EH9 1AB");
    assert.equal(empty.available, true);
    assert.deepEqual(empty.entries, []);
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ message: "Offline" }, { status: 503 }),
    );
    await assert.rejects(getCommunityLeaderboard("EH9 1AB"), /Offline/);
  } finally {
    apiConfig.useMock = previous;
  }
});
test("rankings reject wrong postcode, malformed points and duplicate member identities", () => {
  const response = { postcode: "EH9 1AB", users };
  assert.throws(
    () => leaderboardFromMetric(response, "EH9 1AD"),
    /different postcode/,
  );
  assert.throws(
    () =>
      leaderboardFromMetric(
        { ...response, users: [{ ...users[0], points: -1 }] },
        "EH9 1AB",
      ),
    /invalid community member/,
  );
  assert.throws(
    () =>
      leaderboardFromMetric(
        { ...response, users: [users[0], users[0]] },
        "EH9 1AB",
      ),
    /invalid community member/,
  );
});
test("metrics proxy preserves encoded postcodes and trailing slash, and rejects removed leaderboard routes and metrics writes", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(url);
    return Response.json({ postcode: "EH9 1AB" });
  });
  await proxyApiRequest(new Request("http://app/metrics"), ["metrics"]);
  await proxyApiRequest(new Request("http://app/metrics/EH9%201AB"), [
    "metrics",
    "EH9 1AB",
  ]);
  assert.ok(calls[0].endsWith("/metrics/"));
  assert.ok(calls[1].endsWith("/metrics/EH9%201AB"));
  for (const path of [
    ["postcodes", "EH9 1AB", "leaderboard"],
    ["metrics", ".."],
    ["metrics", "postcode", "extra"],
  ])
    assert.equal(
      (await proxyApiRequest(new Request("http://app/test"), path)).status,
      404,
    );
  assert.equal(
    (
      await proxyApiRequest(
        new Request("http://app/metrics", { method: "POST", body: "{}" }),
        ["metrics"],
      )
    ).status,
    404,
  );
  assert.equal(calls.length, 2);
});
test("demo ranks only approved own-community actions, updates after completion and handles ties", async () => {
  await mockLogin(demoInfo);
  await mockCompleteTask({
    taskId: "walk-journey",
    communityId: "eh3-9gd",
    proof: { declaration: true },
  });
  const db = readDatabase();
  const original = db.accounts[0];
  for (const [id, postcode, communityId] of [
    ["other", "EH3 9GD", "eh3-9gd"],
    ["third", "EH3 9GD", "eh3-9gd"],
    ["outside", "EH3 9FG", "eh3-9fg"],
  ]) {
    db.accounts.push({
      ...original,
      user: { ...original.user, id, name: id, postcode, communityId },
    });
  }
  const completion = db.completions[0];
  db.completions.push(
    { ...completion, id: "other-1", userId: "other" },
    { ...completion, id: "other-2", userId: "other" },
    { ...completion, id: "third-1", userId: "third" },
    { ...completion, id: "pending", userId: "other", status: "pending" },
    { ...completion, id: "rejected", userId: "other", status: "rejected" },
    {
      ...completion,
      id: "other-community",
      userId: original.user.id,
      communityId: "eh3-9fg",
    },
  );
  writeDatabase(db);
  const result = await mockLeaderboard("EH3 9GD");
  assert.deepEqual(
    result.entries.map((entry) => [entry.userId, entry.points, entry.rank]),
    [
      ["demo-resident", 2, 1],
      ["other", 2, 1],
      ["third", 1, 3],
    ],
  );
  await assert.rejects(
    mockLeaderboard("EH3 9FG"),
    (error) => error instanceof ApiError && error.status === 403,
  );
  await mockLogout();
  await assert.rejects(
    mockLeaderboard("EH3 9GD"),
    (error) => error instanceof ApiError && error.status === 401,
  );
});
