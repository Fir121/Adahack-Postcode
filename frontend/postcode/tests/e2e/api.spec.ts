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
async function fixtures(page: Page) {
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
    if (request.method() === "POST") {
      writes.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: profile });
    }
    const body =
      path === "/users"
        ? [profile]
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
  return { paths, writes };
}
test("live-shaped data drives profiles, centroids, tasks and honest unavailable states", async ({
  page,
}) => {
  const { paths } = await fixtures(page);
  await page.goto("/login");
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Development profiles are not password protected.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue with profile" }).click();
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
  await page.getByRole("button", { name: "View action", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Fresh detail from the task endpoint."),
  ).toBeVisible();
  await expect(dialog.getByText("1 point", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Complete action", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Explore a postcode").selectOption("eh9-1ad");
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH9 1AD");
  await page.reload();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH9 1AB");
  await page.goto("/account");
  await expect(page.getByText(profile.email)).toBeVisible();
  await expect(
    page.getByText(/Action history isn.t available yet/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch profile" }).click();
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
  const { writes } = await fixtures(page);
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
test("API failures surface a retry instead of silently supplying demo profiles", async ({
  page,
}) => {
  await fixtures(page);
  await page.route("**/api/backend/users", (route) =>
    route.fulfill({
      status: 502,
      json: { message: "Development server is offline." },
    }),
  );
  await page.goto("/login");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Development server is offline." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try the demo", exact: true }),
  ).toHaveCount(0);
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
test("real server smoke: select an existing profile and load real tasks/centroids", async ({
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
  await page.getByRole("button", { name: "Continue with profile" }).click();
  await expect(page.locator(".sidebar-identity h2")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View action", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-postcode-label")).not.toHaveCount(0);
  await page.getByRole("button", { name: "View action", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading")).toBeVisible();
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
  await page.getByRole("button", { name: "Continue with profile" }).click();
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
  await page.getByRole("button", { name: "Continue with profile" }).click();
  await page.getByRole("button", { name: "My community leaderboard" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Leaderboard coming soon" }),
  ).toBeVisible();
  await expect(dialog.getByRole("table")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Continue with profile" }).click();
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
