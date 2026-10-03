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

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});
beforeEach(() => storage.clear());

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
    /isn’t part of the demo/,
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
    /don’t match/,
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
  await assert.rejects(apiRequest("/tasks"), /couldn’t reach the API/);
});

test("real auth translates 401 into signed out and real uploads use multipart without overriding its boundary", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  try {
    t.mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(JSON.stringify({ message: "Sign in" }), { status: 401 }),
    );
    assert.equal(await getCurrentUser(), null);
    t.mock.method(
      globalThis,
      "fetch",
      async (url: string, options: RequestInit) => {
        assert.ok(url.endsWith("/completions"));
        assert.ok(options.body instanceof FormData);
        assert.equal(new Headers(options.headers).has("Content-Type"), false);
        assert.equal(options.body.get("taskId"), "plant-pot");
        assert.equal((options.body.get("image") as File).name, "plant.png");
        return new Response(
          JSON.stringify({
            completion: { status: "approved" },
            progress: {
              score: 0.69,
              scoreMax: 1,
              totalActions: 205,
              activityByIndicator: {},
              stats: [],
            },
          }),
          { status: 200 },
        );
      },
    );
    const result = await completeTask({
      taskId: "plant-pot",
      communityId: "eh3-9gd",
      proof: { image: new File(["png"], "plant.png", { type: "image/png" }) },
    });
    assert.equal(result.progress.score, 69);
    assert.equal("scoreMax" in result.progress, false);
  } finally {
    apiConfig.useMock = previous;
  }
});
