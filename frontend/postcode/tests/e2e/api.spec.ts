import { dayKey } from "../../lib/utils";
import { expect, test, type Page } from "@playwright/test";
test.skip(
  process.env.E2E_API === "false",
  "Build with NEXT_PUBLIC_USE_MOCK_API=false to test the API",
);
const coordinates = [
  { postcode: "EH9 1AB", latitude: 55.935324, longitude: -3.175028 },
  { postcode: "EH9 1AD", latitude: 55.93478, longitude: -3.178341 },
];
const profile = {
  user_id: "fixture-user",
  name: "API Neighbour",
  email: "api@example.test",
  postcode: "EH9 1AB",
};
const task = {
  task_id: "1",
  name: "Short Hop",
  description: "Walk or cycle one journey.",
  points: 1,
};
async function fixtures(page: Page, options: { registered?: boolean } = {}) {
  let registered = options.registered ?? true;
  const records: {
    user_id: string;
    task_id: string;
    date: string;
    points: number;
  }[] = [];
  const activityWrites: unknown[] = [];
  const paths: string[] = [];
  const writes: unknown[] = [];
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await page.route("**/api/backend/**", async (route) => {
    const request = route.request();
    const path = decodeURIComponent(
      new URL(request.url()).pathname.replace("/api/backend", ""),
    ).replace(/\/$/, "");
    paths.push(path);
    if (path.startsWith("/activities/")) {
      if (request.method() === "POST") {
        const input = request.postDataJSON();
        activityWrites.push(input);
        const record = {
          ...input,
          user_id: profile.user_id,
          points: task.points,
        };
        records.push(record);
        return route.fulfill({ status: 201, json: record });
      }
      const date = new URL(request.url()).searchParams.get("date");
      return route.fulfill({
        status: 200,
        json: date ? records.filter((record) => record.date === date) : records,
      });
    }
    if (request.method() === "POST") {
      registered = true;
      writes.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: profile });
    }
    const body =
      path === "/users"
        ? registered
          ? [profile]
          : []
        : path === "/users/fixture-user"
          ? profile
          : path === "/tasks"
            ? [task]
            : path === "/tasks/1"
              ? { ...task, description: "Fresh detail from the task endpoint." }
              : path === "/coordinates"
                ? coordinates
                : coordinates.find(
                    (coordinate) =>
                      path === "/coordinates/" + coordinate.postcode,
                  );
    return route.fulfill(
      body
        ? { status: 200, json: body }
        : { status: 404, json: { message: "Not found" } },
    );
  });
  return { paths, writes, activityWrites, records };
}
test("live-shaped data drives profiles, centroids, tasks and honest unavailable states", async ({
  page,
}) => {
  const { paths } = await fixtures(page);
  await page.goto("/login");
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByLabel("Email address").fill(profile.email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH9 1AB");
  await expect(
    page.getByText("Green Score pending", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".score-ring")).toHaveCount(0);
  await expect(page.locator(".map-postcode-label")).toHaveCount(2);
  await expect(page.locator(".map-postcode-label.selected")).toContainText(
    "Pending",
  );
  await expect(
    page.locator('.map-decoration[data-asset-type="house"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.map-decoration[data-asset-type="tree"]'),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Take this action", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Fresh detail from the task endpoint."),
  ).toBeVisible();
  await expect(dialog.getByText("1 point", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Record action", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Explore a postcode").selectOption("eh9-1ad");
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH9 1AD");
  await page.reload();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH9 1AB");
  await page.goto("/account");
  await expect(page.getByText(profile.email)).toBeVisible();
  await expect(
    page.getByText("Your first good thing is waiting."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  expect(paths).toContain("/users/fixture-user");
  expect(paths).toContain("/tasks/1");
  expect(paths).toContain("/coordinates/EH9 1AD");
  expect(
    paths.some(
      (path) =>
        path.includes("/auth/") ||
        path.includes("/completions") ||
        path === "/users/me",
    ),
  ).toBe(false);
});
test("signup validates supported postcodes and sends the exact password-free user payload", async ({
  page,
}) => {
  const { writes } = await fixtures(page, { registered: false });
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(profile.name);
  await page.getByLabel("Email address").fill(profile.email);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.getByLabel("Your postcode").fill("EH3 9GD");
  await page.getByRole("button", { name: /grow together/ }).click();
  await expect(
    page.getByText("Choose a supported postcode listed below."),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByLabel("Your postcode").fill("eh91ab");
  await page.getByRole("button", { name: /grow together/ }).click();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH9 1AB");
  expect(writes).toEqual([
    { name: profile.name, email: profile.email, postcode: "EH9 1AB" },
  ]);
});
test("email-only login shows API failures and can retry without creating a user", async ({
  page,
}) => {
  await fixtures(page);
  let offline = true;
  await page.route("**/api/backend/users", (route) =>
    route.fulfill(
      offline
        ? { status: 502, json: { message: "Development server is offline." } }
        : { json: [profile] },
    ),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(profile.email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Development server is offline." }),
  ).toBeVisible();
  offline = false;
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH9 1AB");
});
test("the supplied PNG is used for the logo, favicon, touch icon and app manifest", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("/login");
  await expect(page.locator(".brand-symbol img")).toHaveAttribute(
    "src",
    "/brand/icon.png",
  );
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(favicon).toContain("icon.png");
  const touchIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect(touchIcon).toContain("apple-icon.png");
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.name).toBe("Our Patch");
  expect(manifest.icons[0].src).toBe("/brand/icon.png");
  const logo = await page.request.get("/brand/icon.png");
  const icon = await page.request.get(favicon!);
  expect(await logo.body()).toEqual(await icon.body());
});
test("real server smoke: email login, activity history and derived leaderboard", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_LIVE_API !== "true",
    "Optional live read-only API smoke",
  );
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/login");
  const users = await (await page.request.get("/api/backend/users")).json();
  test.skip(!users.length, "No live users to sign in");
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".sidebar-identity h2")).toBeVisible();
  await page.getByRole("button", { name: "My community leaderboard" }).click();
  await expect(
    page.getByRole("dialog").locator(".leaderboard-current-user"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Your action history" }),
  ).toBeVisible();
  const activities = await (
    await page.request.get(
      "/api/backend/activities/" + encodeURIComponent(users[0].user_id),
    )
  ).json();
  if (activities.length)
    await expect(page.locator(".history-list li")).toHaveCount(
      activities.length,
    );
  else await expect(page.locator(".empty-history")).toBeVisible();
  await expect(page.locator(".account-page [role=alert]")).toHaveCount(0);
});
test("leaderboard loads on demand for home postcode, highlights identity, refreshes and restores focus", async ({
  page,
}) => {
  await fixtures(page);
  let payload = {
    postcode: "EH9 1AB",
    entries: [
      { user_id: "third", name: "Casey", rank: 3, points: 3 },
      { user_id: profile.user_id, name: profile.name, rank: 2, points: 8 },
      { user_id: "first", name: profile.name, rank: 1, points: 12 },
    ],
  };
  const requests: string[] = [];
  let release!: () => void;
  const waitForResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/backend/postcodes/**/leaderboard", async (route) => {
    requests.push(decodeURIComponent(new URL(route.request().url()).pathname));
    await waitForResponse;
    await route.fulfill({ status: 200, json: payload });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(profile.email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Explore a postcode").selectOption("eh9-1ad");
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH9 1AD");
  const trigger = page.getByRole("button", {
    name: "My community leaderboard",
  });
  expect(requests).toHaveLength(0);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Community leaderboard" });
  await expect(
    dialog.getByText("Loading your community leaderboard…"),
  ).toBeVisible();
  release();
  const table = dialog.getByRole("table", {
    name: "Community leaderboard for EH9 1AB",
  });
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader")).toHaveText([
    "Rank",
    "Name",
    "Points",
  ]);
  await expect(table.locator("tbody tr").first()).toContainText("#1");
  await expect(table.locator(".leaderboard-current-user")).toContainText("#2");
  await expect(table.locator(".leaderboard-current-user")).toContainText("You");
  await expect(table.locator(".leaderboard-current-user td").last()).toHaveText(
    "8",
  );
  await expect(dialog.locator(".leaderboard-position")).toContainText("#2");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  payload = {
    ...payload,
    entries: payload.entries.map((entry) =>
      entry.user_id === profile.user_id ? { ...entry, points: 9 } : entry,
    ),
  };
  await trigger.click();
  await expect(
    dialog.locator(".leaderboard-current-user td").last(),
  ).toHaveText("9");
  payload = {
    ...payload,
    entries: payload.entries.map((entry) =>
      entry.user_id === profile.user_id ? { ...entry, points: 10 } : entry,
    ),
  };
  await dialog.getByRole("button", { name: "Refresh rankings" }).click();
  await expect(
    dialog.locator(".leaderboard-current-user td").last(),
  ).toHaveText("10");
  expect(requests).toHaveLength(3);
  expect(
    requests.every(
      (path) => path === "/api/backend/postcodes/EH9 1AB/leaderboard",
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("leaderboard-desktop.png"),
  });
});

test("leaderboard handles pending endpoint, empty result, errors and a missing current user", async ({
  page,
}) => {
  await fixtures(page);
  let state = "missing";
  await page.route("**/api/backend/postcodes/**/leaderboard", (route) => {
    if (state === "missing")
      return route.fulfill({
        status: 404,
        json: { message: "Not implemented" },
      });
    if (state === "error")
      return route.fulfill({
        status: 503,
        json: { message: "Rankings unavailable. Try again." },
      });
    return route.fulfill({
      status: 200,
      json: {
        postcode: "EH9 1AB",
        entries:
          state === "empty"
            ? []
            : [{ user_id: "another", name: "Jamie", rank: 1, points: 0 }],
      },
    });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(profile.email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "My community leaderboard" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("table")).toBeVisible();
  await expect(
    dialog.locator(".leaderboard-current-user td").last(),
  ).toHaveText("0");
  await expect(
    dialog.getByText(/Points come from recorded activities/),
  ).toBeVisible();
  state = "empty";
  await dialog.getByRole("button", { name: "Refresh rankings" }).click();
  await expect(
    dialog.getByRole("heading", { name: "No rankings yet" }),
  ).toBeVisible();
  state = "error";
  await dialog.getByRole("button", { name: "Refresh rankings" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Rankings unavailable. Try again.",
  );
  state = "available";
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(
    dialog.getByText(/Your position isn.t available yet/),
  ).toBeVisible();
  await expect(dialog.locator(".leaderboard-current-user")).toHaveCount(0);
  await expect(dialog.getByRole("table")).toContainText("Jamie");
});

test("leaderboard popup fits the mobile drawer and retains a readable table", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtures(page);
  await page.route("**/api/backend/postcodes/**/leaderboard", (route) =>
    route.fulfill({
      json: {
        postcode: "EH9 1AB",
        entries: [
          { user_id: profile.user_id, name: profile.name, rank: 1, points: 0 },
        ],
      },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(profile.email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: /EH9 1AB · Green Score pending/ })
    .click();
  await page.getByRole("button", { name: "My community leaderboard" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("table")).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("leaderboard-mobile.png"),
  });
  await dialog.getByRole("button", { name: "Close leaderboard" }).click();
  await expect(dialog).not.toBeVisible();
});

test("recording an action posts Swagger input, updates history/leaderboard and preserves pending Green Score", async ({
  page,
}) => {
  const { activityWrites } = await fixtures(page);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(" API@EXAMPLE.TEST ");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Take this action" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Record action" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Action recorded." }),
  ).toBeVisible();
  expect(activityWrites).toEqual([
    { task_id: task.task_id, date: dayKey(new Date()) },
  ]);
  await dialog
    .getByRole("button", { name: "Back to my neighbourhood" })
    .click();
  await expect(
    page.getByText("Green Score pending", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "My community leaderboard" }).click();
  await expect(
    page.getByRole("dialog").locator(".leaderboard-current-user td").last(),
  ).toHaveText("1");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Explore all actions" }).click();
  await expect(page.locator(".action-card")).toBeDisabled();
  await page.goto("/account");
  await expect(page.locator(".history-list")).toContainText("Short Hop");
  await expect(page.locator(".history-list")).toContainText(
    "Action recorded · 1 point",
  );
  await page.reload();
  await expect(page.locator(".history-list")).toContainText("Short Hop");
});

test("email login rejects unknown emails and signup redirects duplicate emails to sign-in", async ({
  page,
}) => {
  await fixtures(page);
  await page.goto("/login");
  await page.getByLabel("Email address").fill("unknown@example.test");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "No account was found" }),
  ).toBeVisible();
  await expect(page).toHaveURL("/login");
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Neighbour");
  await page.getByLabel("Email address").fill(profile.email);
  await page.getByLabel("Your postcode").fill(profile.postcode);
  await page.getByRole("button", { name: /grow together/ }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sign in instead" }),
  ).toBeVisible();
});
