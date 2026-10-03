import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { apiConfig } from "../lib/api/config";
import {
  getCommunities,
  getCommunity,
  getSupportedPostcodes,
} from "../lib/api/postcodes";
import { getTasks, getTask } from "../lib/api/tasks";
import {
  createUser,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
} from "../lib/api/users";
import {
  getCurrentUser,
  logout,
  PROFILE_KEY,
  selectDevelopmentProfile,
  signup,
} from "../lib/api/auth";
import { adaptCoordinates, adaptTask, adaptUser } from "../lib/api/adapters";
import { proxyApiRequest } from "../lib/api/proxy";
import { ApiError } from "../lib/api/client";

const coordinate = {
  postcode: "EH9 1AB",
  latitude: 55.935324,
  longitude: -3.175028,
};
const task = {
  task_id: "1",
  name: "Short Hop",
  description: "Walk or cycle one journey.",
  points: 1,
};
const user = {
  user_id: "test-user",
  name: "Test Neighbour",
  email: "test@example.test",
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

test("Swagger list/detail endpoints adapt actual fields and leave missing scores unavailable", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const path = url.replace(apiConfig.baseUrl, "");
    paths.push(path);
    const body =
      path === "/coordinates/"
        ? [coordinate]
        : path === "/coordinates/EH9%201AB"
          ? coordinate
          : path === "/tasks"
            ? [task]
            : path === "/tasks/1"
              ? task
              : path === "/users"
                ? [user]
                : path === "/users/test-user"
                  ? user
                  : null;
    assert.ok(body, "Unexpected API path: " + path);
    return Response.json(body);
  });
  try {
    const communities = await getCommunities();
    assert.deepEqual(communities[0].centroid, {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
    assert.equal(communities[0].progress.scoreAvailable, false);
    assert.deepEqual(communities[0].indicators, []);
    assert.equal((await getCommunity("eh9-1ab")).postcode, coordinate.postcode);
    assert.deepEqual(await getSupportedPostcodes(), ["EH9 1AB"]);
    assert.equal((await getTasks())[0].points, 1);
    assert.equal((await getTask("1")).completionAvailable, false);
    assert.equal((await getUsers())[0].communityId, "eh9-1ab");
    assert.equal((await getUser("test-user")).id, "test-user");
    await selectDevelopmentProfile("test-user");
    assert.equal(localStorage.getItem(PROFILE_KEY), "test-user");
    assert.equal((await getCurrentUser())?.postcode, "EH9 1AB");
    await logout();
    assert.equal(await getCurrentUser(), null);
    assert.ok(
      paths.every(
        (path) =>
          !path.includes("/auth") &&
          !path.includes("/postcodes") &&
          !path.includes("/completions"),
      ),
    );
  } finally {
    apiConfig.useMock = previous;
  }
});

test("user writes send only Swagger fields and reject unsupported postcodes before creating users", async (t) => {
  const previous = apiConfig.useMock;
  apiConfig.useMock = false;
  const writes: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      if (url.endsWith("/coordinates/")) return Response.json([coordinate]);
      writes.push(options.method!);
      if (options.method === "DELETE")
        return new Response(null, { status: 200 });
      assert.deepEqual(JSON.parse(options.body as string), {
        name: user.name,
        email: user.email,
        postcode: "EH9 1AB",
      });
      return Response.json(user, {
        status: options.method === "POST" ? 201 : 200,
      });
    },
  );
  try {
    const input = {
      name: user.name,
      email: user.email,
      postcode: "eh91ab",
      password: "never-send-this",
    };
    assert.equal((await signup(input)).user.id, user.user_id);
    assert.equal(localStorage.getItem(PROFILE_KEY), user.user_id);
    await createUser(input);
    await updateUser(user.user_id, input);
    await deleteUser(user.user_id);
    await assert.rejects(
      createUser({ ...input, postcode: "EH3 9GD" }),
      (error) => error instanceof ApiError && Boolean(error.fields?.postcode),
    );
    assert.deepEqual(writes, ["POST", "POST", "PUT", "DELETE"]);
  } finally {
    apiConfig.useMock = previous;
  }
});

test("malformed API data fails visibly instead of falling back to demo data", () => {
  assert.throws(
    () => adaptCoordinates({ ...coordinate, latitude: 100 }),
    /invalid postcode coordinates/,
  );
  assert.throws(
    () => adaptTask({ ...task, points: Number.NaN }),
    /invalid task points/,
  );
  assert.throws(() => adaptUser({ ...user, postcode: "" }), /incomplete data/);
});

test("proxy preserves postcode escaping, ngrok header, errors and writes, and rejects unsupported paths", async (t) => {
  const upstream =
    process.env.API_BASE_URL ??
    "https://chivalry-handlebar-hangover.ngrok-free.dev/api/v1";
  const calls: { url: string; options: RequestInit }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      return Response.json({ message: "No postcode" }, { status: 404 });
    },
  );
  let response = await proxyApiRequest(
    new Request("http://app/api/backend/coordinates/EH3%209GD"),
    ["coordinates", "EH3 9GD"],
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, "No postcode");
  assert.equal(
    calls[0].url,
    upstream.replace(/\/$/, "") + "/coordinates/EH3%209GD",
  );
  assert.equal(
    new Headers(calls[0].options.headers).get("ngrok-skip-browser-warning"),
    "true",
  );
  assert.equal(calls[0].options.cache, "no-store");
  await proxyApiRequest(new Request("http://app/api/backend/coordinates"), [
    "coordinates",
  ]);
  assert.ok(calls[1].url.endsWith("/coordinates/"));
  await proxyApiRequest(
    new Request("http://app/api/backend/users", {
      method: "POST",
      body: JSON.stringify(user),
    }),
    ["users"],
  );
  assert.equal(calls[2].options.method, "POST");
  assert.equal(calls[2].options.body, JSON.stringify(user));
  for (const path of [
    ["auth", "login"],
    ["users", ".."],
    ["tasks", "1", "extra"],
  ]) {
    response = await proxyApiRequest(
      new Request("http://app/api/backend/test"),
      path,
    );
    assert.equal(response.status, 404);
  }
  assert.equal(calls.length, 3);
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("<html>ngrok</html>", {
        headers: { "content-type": "text/html" },
      }),
  );
  assert.equal(
    (
      await proxyApiRequest(new Request("http://app/api/backend/tasks"), [
        "tasks",
      ])
    ).status,
    502,
  );
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Offline");
  });
  assert.equal(
    (
      await proxyApiRequest(new Request("http://app/api/backend/tasks"), [
        "tasks",
      ])
    ).status,
    502,
  );
});
