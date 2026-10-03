import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { apiConfig } from "../lib/api/config";
import { login, PROFILE_KEY, logout, getCurrentUser } from "../lib/api/auth";
import { getCompletionHistory, completeTask } from "../lib/api/completions";
import {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  validActivityDate,
  adaptActivity,
  activityToCompletion,
} from "../lib/api/activities";
import { adaptTask, adaptUser } from "../lib/api/adapters";
import { proxyApiRequest } from "../lib/api/proxy";
import { dayKey } from "../lib/utils";

const user = {
  user_id: "person@example.test",
  name: "Neighbour",
  email: "person@example.test",
  postcode: "EH9 1AB",
};
const task = {
  task_id: "1",
  name: "Walk",
  description: "Walk one journey",
  points: 3,
};
const today = dayKey(new Date());
const activity = {
  user_id: user.user_id,
  task_id: "1",
  date: today,
  points: 3,
  postcode: "EH9 1AB",
};
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});
beforeEach(() => storage.clear());

test("email login looks up users case-insensitively, fetches fresh detail and persists only ID", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    paths.push(url);
    return Response.json(url.endsWith("/users") ? [user] : user);
  });
  try {
    assert.equal(
      (await login({ email: " PERSON@EXAMPLE.TEST " })).user.id,
      user.user_id,
    );
    assert.equal(storage.get(PROFILE_KEY), user.user_id);
    assert.ok(paths[1].endsWith("/users/person%40example.test"));
    assert.equal((await getCurrentUser())?.email, user.email);
    await logout();
    assert.equal(storage.size, 0);
    t.mock.method(globalThis, "fetch", async () => Response.json([]));
    await assert.rejects(login({ email: user.email }), /No account/);
    t.mock.method(globalThis, "fetch", async () =>
      Response.json([user, { ...user, user_id: "duplicate" }]),
    );
    await assert.rejects(login({ email: user.email }), /More than one user/);
    assert.equal(storage.size, 0);
  } finally {
    apiConfig.useMock = previous;
  }
});

test("activity CRUD uses exact Swagger payloads, encoded IDs and query filters", async (t) => {
  const calls: { url: string; options: RequestInit }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      if (options.method === "DELETE")
        return new Response(null, { status: 200 });
      if (!options.method) return Response.json([activity]);
      assert.deepEqual(JSON.parse(options.body as string), {
        points: 3,
      });
      return Response.json(activity, {
        status: options.method === "POST" ? 201 : 200,
      });
    },
  );
  await getActivities({ user_id: user.user_id, date: today, task_id: "1" });
  await createActivity(
    { userId: user.user_id, taskId: "1", date: today },
    { points: 3 },
  );
  await updateActivity(
    { userId: user.user_id, taskId: "1", date: today },
    { points: 3 },
  );
  await deleteActivity({ userId: user.user_id, taskId: "1", date: today });
  assert.ok(
    calls[0].url.endsWith(
      "/activities?date=" + today + "&user_id=person%40example.test&task_id=1",
    ),
  );
  assert.ok(
    calls[3].url.endsWith("/activities/" + today + "/person%40example.test/1"),
  );
  assert.deepEqual(
    calls.map((call) => call.options.method ?? "GET"),
    ["GET", "POST", "PUT", "DELETE"],
  );
  await assert.rejects(
    deleteActivity({ userId: user.user_id, taskId: "", date: today }),
    /Choose a user, task/,
  );
});

test("recording uses backend activity points, history resolves task names and no Green Score is fabricated", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  storage.set(PROFILE_KEY, user.user_id);
  const records: (typeof activity)[] = [];
  let posts = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      if (url.includes("/users/")) return Response.json(user);
      if (url.endsWith("/tasks")) return Response.json([task]);
      if (url.includes("/tasks/")) return Response.json(task);
      if (options.method === "POST") {
        posts++;
        assert.deepEqual(JSON.parse(options.body as string), {
          points: task.points,
        });
        records.push(activity);
        return Response.json(activity, { status: 201 });
      }
      return Response.json(records);
    },
  );
  try {
    const result = await completeTask({
      taskId: "1",
      communityId: "eh9-1ab",
      proof: { declaration: true },
    });
    assert.equal(result.completion.status, "recorded");
    assert.equal(result.completion.points, 3);
    assert.equal(result.progress.scoreAvailable, false);
    const history = await getCompletionHistory(user.user_id);
    assert.equal(history[0].taskTitle, "Walk");
    assert.equal(history[0].activityDate, today);
    await assert.rejects(
      completeTask({ taskId: "1", communityId: "eh9-1ab", proof: {} }),
      /already recorded/,
    );
    await assert.rejects(
      completeTask({ taskId: "1", communityId: "eh9-1ad", proof: {} }),
      /own postcode/,
    );
    assert.equal(posts, 1);
  } finally {
    apiConfig.useMock = previous;
  }
});

test("dates and user identities validate; activity proxy forwards only documented filters", async (t) => {
  assert.equal(validActivityDate("2026-02-30"), false);
  assert.equal(validActivityDate("2024-02-29"), true);
  assert.throws(
    () =>
      adaptActivity(
        { ...activity, user_id: "wrong" },
        { user_id: user.user_id },
      ),
    /invalid activity/,
  );
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls.push(url);
    return Response.json([]);
  });
  const path = ["activities", today, user.user_id, "1"];
  await proxyApiRequest(
    new Request(
      "http://app/activities?date=" +
        today +
        "&user_id=person%40example.test&task_id=1&ignored=true",
    ),
    ["activities"],
  );
  await proxyApiRequest(
    new Request("http://app/activity?ignored=true", { method: "DELETE" }),
    path,
  );
  assert.ok(
    calls[0].endsWith(
      "/activities?date=" + today + "&user_id=person%40example.test&task_id=1",
    ),
  );
  assert.ok(
    calls[1].endsWith("/activities/" + today + "/person%40example.test/1"),
  );
  for (const [method, segments] of [
    ["PATCH", path],
    ["GET", path],
    ["GET", ["activities", user.user_id]],
    ["POST", ["activities"]],
    ["DELETE", ["activities", "2026-02-30", "user", "1"]],
  ] as const) {
    assert.equal(
      (
        await proxyApiRequest(new Request("http://app/activity", { method }), [
          ...segments,
        ])
      ).status,
      404,
    );
  }
  assert.equal(calls.length, 2);
  const withoutPoints = {
    user_id: activity.user_id,
    task_id: activity.task_id,
    date: activity.date,
  };
  assert.equal(adaptActivity(withoutPoints).points, undefined);
  const historic = activityToCompletion(
    { ...activity, postcode: "EH9 1AD" },
    adaptUser(user),
    [adaptTask(task)],
  );
  assert.equal(historic.communityId, "eh9-1ad");
  assert.equal(
    historic.id,
    JSON.stringify([today, user.user_id, task.task_id]),
  );
  assert.throws(
    () => adaptActivity({ ...activity, points: -1 }),
    /invalid activity/,
  );
});
