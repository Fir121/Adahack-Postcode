import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { apiConfig } from "../lib/api/config";
import { ApiError } from "../lib/api/client";
import {
  getCommunityLeaderboard,
  adaptLeaderboard,
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
const entries = [
  { user_id: "a", name: "Alex", rank: 2, points: 8 },
  { user_id: "b", name: "Jamie", rank: 1, points: 12 },
];
test("leaderboard request uses encoded home postcode and preserves backend ranks and points", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.ok(url.endsWith("/postcodes/EH9%201AB/leaderboard"));
    return Response.json({ postcode: "EH9 1AB", entries });
  });
  try {
    const result = await getCommunityLeaderboard("eh91ab");
    assert.equal(result.available, true);
    assert.deepEqual(
      result.entries.map((entry) => [entry.userId, entry.rank, entry.points]),
      [
        ["b", 1, 12],
        ["a", 2, 8],
      ],
    );
  } finally {
    apiConfig.useMock = previous;
  }
});
test("missing endpoint, empty ranking and API failures remain distinct", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  try {
    for (const status of [404, 501]) {
      t.mock.method(globalThis, "fetch", async () =>
        Response.json({ message: "Coming soon" }, { status }),
      );
      assert.equal((await getCommunityLeaderboard("EH9 1AB")).available, false);
    }
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ postcode: "EH9 1AB", entries: [] }),
    );
    assert.equal((await getCommunityLeaderboard("EH9 1AB")).available, true);
    t.mock.method(globalThis, "fetch", async () =>
      Response.json({ message: "Offline" }, { status: 503 }),
    );
    await assert.rejects(getCommunityLeaderboard("EH9 1AB"), /Offline/);
  } finally {
    apiConfig.useMock = previous;
  }
});
test("rankings reject wrong community, malformed points/ranks and duplicate identities", () => {
  const response = { postcode: "EH9 1AB", entries };
  assert.throws(
    () => adaptLeaderboard(response, "EH9 1AD"),
    /invalid community leaderboard/,
  );
  assert.throws(() =>
    adaptLeaderboard(
      { ...response, entries: [{ ...entries[0], points: -1 }] },
      "EH9 1AB",
    ),
  );
  assert.throws(() =>
    adaptLeaderboard(
      { ...response, entries: [{ ...entries[0], rank: 0 }] },
      "EH9 1AB",
    ),
  );
  assert.throws(() =>
    adaptLeaderboard(
      { ...response, entries: [entries[0], entries[0]] },
      "EH9 1AB",
    ),
  );
});
test("proxy forwards only GET for leaderboard and preserves HTML not-implemented statuses", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(url);
    return new Response("<html>Not Found</html>", {
      status: 404,
      headers: { "content-type": "text/html" },
    });
  });
  const path = ["postcodes", "EH9 1AB", "leaderboard"];
  const url = "http://app/api/backend/postcodes/EH9%201AB/leaderboard";
  const response = await proxyApiRequest(new Request(url), path);
  assert.equal(response.status, 404);
  assert.match((await response.json()).message, /not available/);
  assert.ok(calls[0].endsWith("/postcodes/EH9%201AB/leaderboard"));
  assert.equal(
    (await proxyApiRequest(new Request(url, { method: "POST" }), path)).status,
    404,
  );
  assert.equal(
    (
      await proxyApiRequest(new Request(url), [
        "postcodes",
        "invalid",
        "leaderboard",
      ])
    ).status,
    404,
  );
  assert.equal(
    (
      await proxyApiRequest(new Request(url), [
        "postcodes",
        "EH9 1AB",
        "progress",
      ])
    ).status,
    404,
  );
  assert.equal(calls.length, 1);
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
