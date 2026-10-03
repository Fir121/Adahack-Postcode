import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  mockCommunity,
  mockCompleteTask,
  mockCurrentUser,
  mockHistory,
  mockLogin,
  mockLogout,
  mockSignup,
} from "../lib/mock/backend";
import { demoInfo, mockTasks } from "../lib/mock/fixtures";
import { STORAGE_KEY } from "../lib/mock/store";
import { greenLevel, normalizeScore } from "../lib/scoring";
import { isPostcodeFormat, normalizePostcode } from "../lib/utils";
import { isTaskAvailable, recommendTasks, validateProof } from "../lib/tasks";
import { apiRequest, ApiError } from "../lib/api/client";
import { apiConfig } from "../lib/api/config";
import { getCurrentUser } from "../lib/api/auth";
import { completeTask } from "../lib/api/completions";
import { adaptCommunity } from "../lib/api/postcodes";
import {
  communityDecorations,
  decorationAnimates,
  treeCount,
  houseSaturation,
} from "../lib/map/decorations";
import { scoreColor, scoreTextColor } from "../lib/map/config";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});
beforeEach(() => storage.clear());

test("centroid-only API data builds a score-dependent frontend scene", async () => {
  await mockLogin(demoInfo);
  const original = await mockCommunity("eh3-9gd");
  const adapted = adaptCommunity({
    ...original,
    decorations: undefined,
    centroid: { type: "Point", coordinates: [-3.192934, 55.943437] },
  });
  assert.deepEqual(adapted.centroid, original.centroid);
  assert.deepEqual(adapted.decorations, []);
  // Backend levels do not override frontend rules derived from the score.
  const sceneAt = (score: number) =>
    communityDecorations({
      ...adapted,
      progress: { ...adapted.progress, score, level: 5 },
    });
  assert.deepEqual(
    sceneAt(0).map((asset) => asset.type),
    ["house", "tree"],
  );
  assert.equal(decorationAnimates("house", 39), false);
  assert.equal(decorationAnimates("house", 40), true);
  assert.equal(decorationAnimates("tree", 0), true);
  assert.equal(treeCount(-50), 1);
  assert.equal(treeCount(10), 1);
  assert.equal(treeCount(11), 2);
  assert.equal(treeCount(68), 7);
  assert.equal(treeCount(1000), 10);
  assert.equal(houseSaturation(0), 0);
  assert.equal(houseSaturation(50), 0.5);
  assert.equal(houseSaturation(100), 1);
  for (let score = 0; score <= 100; score++) {
    const scene = sceneAt(score);
    assert.equal(scene.filter((asset) => asset.type === "house").length, 1);
    const trees = scene.filter((asset) => asset.type === "tree");
    const left = trees.filter((asset) => asset.offsetX < 0).length;
    const right = trees.filter((asset) => asset.offsetX > 0).length;
    assert.ok(trees.length >= 1 && trees.length <= 10);
    assert.ok(Math.abs(left - right) <= 1);
  }
  const duplicated = communityDecorations({
    ...adapted,
    decorations: [
      {
        id: "earned-house",
        type: "house",
        longitude: 0,
        latitude: 0,
        animation: "grow",
        minGreenLevel: 0,
      },
      {
        id: "earned-bike",
        type: "bike",
        longitude: 0,
        latitude: 0,
        animation: "grow",
        minGreenLevel: 0,
      },
    ],
  });
  assert.equal(duplicated.filter((asset) => asset.type === "house").length, 1);
  assert.ok(
    duplicated.every(
      (asset) => asset.type === "house" || asset.type === "tree",
    ),
  );
});

test("score shading moves from red through yellow to green with readable label ink", () => {
  const palette = ["#d94a49", "#f1cc58", "#367754"];
  assert.equal(scoreColor(-20, palette), "rgb(217,74,73)");
  assert.equal(scoreColor(50, palette), "rgb(241,204,88)");
  assert.equal(scoreColor(120, palette), "rgb(54,119,84)");
  assert.equal(scoreTextColor(scoreColor(50, palette)), "#000000");
  assert.equal(scoreTextColor(scoreColor(100, palette)), "#ffffff");
});

test("formatting and existence validation remain separate", async () => {
  assert.equal(normalizePostcode("eh39gd"), "EH3 9GD");
  assert.equal(isPostcodeFormat("EH3 9GD"), true);
  assert.equal(isPostcodeFormat("not a postcode"), false);
  await assert.rejects(
    mockSignup({
      name: "Sam",
      email: "sam@example.test",
      password: "password123",
      postcode: "SW1A 1AA",
    }),
    /isn't part of the demo/,
  );
});

test("signup persists a session without storing plaintext passwords", async () => {
  const result = await mockSignup({
    name: "Sam",
    email: "sam@example.test",
    password: "password123",
    postcode: "eh39gd",
  });
  assert.equal((await mockCurrentUser())?.id, result.user.id);
  assert.equal(storage.get(STORAGE_KEY)?.includes("password123"), false);
  await mockLogout();
  assert.equal(await mockCurrentUser(), null);
  await assert.rejects(
    mockLogin({ email: "sam@example.test", password: "wrong" }),
    /don't match/,
  );
  assert.equal(
    (await mockLogin({ email: "sam@example.test", password: "password123" }))
      .user.id,
    result.user.id,
  );
});

test("completion updates community activity and decorations without changing environmental indicators", async () => {
  await mockLogin(demoInfo);
  const before = await mockCommunity("eh3-9gd");
  const result = await mockCompleteTask({
    taskId: "walk-journey",
    communityId: "eh3-9gd",
    proof: { declaration: true },
  });
  const after = await mockCommunity("eh3-9gd");
  assert.deepEqual(after.indicators, before.indicators);
  assert.equal(after.progress.score, before.progress.score + 1);
  assert.equal(after.progress.totalActions, before.progress.totalActions + 1);
  assert.equal(
    after.progress.activityByIndicator.transport,
    before.progress.activityByIndicator.transport + 1,
  );
  assert.equal(after.decorations.length, before.decorations.length + 1);
  assert.equal(result.completion.status, "approved");
  assert.equal((await mockHistory())[0].taskId, "walk-journey");
  await assert.rejects(
    mockCompleteTask({
      taskId: "walk-journey",
      communityId: "eh3-9gd",
      proof: { declaration: true },
    }),
    /already completed/,
  );
});

test("other communities are explorable but actions require own membership and valid proof", async () => {
  await mockLogin(demoInfo);
  assert.equal((await mockCommunity("eh3-9fg")).postcode, "EH3 9FG");
  await assert.rejects(
    mockCompleteTask({
      taskId: "walk-journey",
      communityId: "eh3-9fg",
      proof: { declaration: true },
    }),
    /own postcode/,
  );
  await assert.rejects(
    mockCompleteTask({
      taskId: "save-energy",
      communityId: "eh3-9gd",
      proof: { declaration: true },
    }),
    /proof/,
  );
  const task = mockTasks.find((t) => t.id === "plant-pot")!;
  assert.ok(
    validateProof(task, {
      image: new File(["text"], "fake.txt", { type: "text/plain" }),
    }).image,
  );
});

test("daily tasks reset by London date; one-off tasks remain unavailable", () => {
  const completion = {
    id: "c",
    userId: "u",
    communityId: "eh3-9gd",
    taskId: "walk-journey",
    taskTitle: "Walk",
    category: "Transport",
    targetIndicators: [],
    completedAt: "2026-10-02T10:00:00Z",
    status: "approved" as const,
  };
  assert.equal(
    isTaskAvailable(
      mockTasks[0],
      [completion],
      "eh3-9gd",
      new Date("2026-10-02T18:00:00Z"),
    ),
    false,
  );
  assert.equal(
    isTaskAvailable(
      mockTasks[0],
      [completion],
      "eh3-9gd",
      new Date("2026-10-03T10:00:00Z"),
    ),
    true,
  );
  assert.equal(
    isTaskAvailable(
      { ...mockTasks[0], repeat: "once" },
      [completion],
      "eh3-9gd",
      new Date("2026-10-03T10:00:00Z"),
    ),
    false,
  );
});

test("scores normalize once and recommendations use the weakest indicator", async () => {
  assert.equal(normalizeScore(0.68, 1), 68);
  assert.equal(normalizeScore(120), 100);
  assert.equal(normalizeScore(Number.NaN), 0);
  assert.equal(greenLevel(100), 5);
  await mockLogin(demoInfo);
  const community = await mockCommunity("eh3-9gd");
  assert.equal(
    recommendTasks(mockTasks, community.indicators)[0].id,
    "walk-journey",
  );
  const adapted = adaptCommunity({
    ...community,
    progress: { ...community.progress, score: 0.68, scoreMax: 1 },
  });
  assert.equal(adapted.progress.score, 68);
  assert.equal("scoreMax" in adapted.progress, false);
});

test("real client sends cookies and preserves validation errors and unavailable states", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      assert.equal(options.credentials, "include");
      return new Response(
        JSON.stringify({
          message: "Photo too large",
          fields: { image: "Use a smaller photo" },
        }),
        { status: 422 },
      );
    },
  );
  await assert.rejects(
    apiRequest("/completions"),
    (error) =>
      error instanceof ApiError &&
      error.status === 422 &&
      error.fields?.image === "Use a smaller photo",
  );
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Network unavailable");
  });
  await assert.rejects(apiRequest("/tasks"), /couldn't reach the API/);
});

test("development profiles clear a deleted selection; unsupported completions never call the API", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  try {
    localStorage.setItem("our-patch-development-profile", "u-1");
    let calls = 0;
    t.mock.method(globalThis, "fetch", async (url: string) => {
      calls++;
      assert.ok(url.endsWith("/users/u-1"));
      return new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
      });
    });
    assert.equal(await getCurrentUser(), null);
    assert.equal(localStorage.getItem("our-patch-development-profile"), null);
    await assert.rejects(
      completeTask({ taskId: "1", communityId: "eh9-1ab", proof: {} }),
      /not available yet/,
    );
    assert.equal(calls, 1);
  } finally {
    apiConfig.useMock = previous;
  }
});
