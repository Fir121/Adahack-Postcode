import { expect, test, type Page } from "@playwright/test";

async function demoLogin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH3 9GD");
  await expect(
    page.getByRole("link", { name: "Our Patch home" }),
  ).toBeVisible();
  await expect(page.locator(".app-header")).toHaveCSS(
    "background-color",
    "rgb(227, 0, 39)",
  );
}

test("completion grows the tree count and adjusts house saturation", async ({
  page,
}) => {
  await demoLogin(page);
  await page.evaluate(() => {
    const key = "pl-green-together-demo-v1";
    const db = JSON.parse(localStorage.getItem(key)!);
    const community = db.communities.find(
      (item: { id: string }) => item.id === "eh3-9gd",
    );
    community.progress.score = 70;
    localStorage.setItem(key, JSON.stringify(db));
  });
  await page.reload();
  await expect(page.locator(".score-ring strong")).toHaveText("70");
  await expect(page.locator(".map-decoration")).toHaveCount(8);
  const house = page.locator(
    '.map-decoration[data-asset-type="house"] .map-sprite',
  );
  await expect(house).toBeVisible();
  expect(
    await house.evaluate((element) => element.getAnimations().length),
  ).toBe(1);
  const before = await page
    .locator(".map-postcode-label.selected")
    .evaluate((element) => element.style.getPropertyValue("--postcode-color"));
  await page.getByRole("button", { name: "Take this action" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Complete action", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Back to my neighbourhood" })
    .click();
  await expect(page.locator(".score-ring strong")).toHaveText("71");
  await expect(page.locator(".map-decoration")).toHaveCount(9);
  await expect(house).toHaveCSS("filter", /saturate\(0\.71\)/);
  await expect
    .poll(() => house.evaluate((element) => element.getAnimations().length))
    .toBe(1);
  const after = await page
    .locator(".map-postcode-label.selected")
    .evaluate((element) => element.style.getPropertyValue("--postcode-color"));
  expect(after).not.toBe(before);
});

test("one house stays above its label and 1–10 balanced trees fit on mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await demoLogin(page);
  async function setScore(score: number) {
    await page.evaluate((score) => {
      const key = "pl-green-together-demo-v1";
      const db = JSON.parse(localStorage.getItem(key)!);
      db.communities.find(
        (item: { id: string }) => item.id === "eh3-9gd",
      ).progress.score = score;
      localStorage.setItem(key, JSON.stringify(db));
    }, score);
    await page.reload();
    await expect(page.locator(".score-ring strong")).toHaveText(String(score));
  }
  const house = page.locator('.map-decoration[data-asset-type="house"]');
  const trees = page.locator('.map-decoration[data-asset-type="tree"]');
  const label = page.locator(".map-postcode-label.selected");
  await setScore(0);
  await expect(house).toHaveCount(1);
  await expect(trees).toHaveCount(1);
  await expect(house.locator(".map-sprite")).toHaveCSS(
    "filter",
    /saturate\(0\)/,
  );
  await setScore(100);
  await expect(house).toHaveCount(1);
  await expect(trees).toHaveCount(10);
  await expect(house.locator(".map-sprite")).toHaveCSS(
    "filter",
    /saturate\(1\)/,
  );
  const sides = await trees.evaluateAll((elements) =>
    elements.map((element) => parseFloat((element as HTMLElement).style.left)),
  );
  expect(sides.filter((x) => x < 0)).toHaveLength(5);
  expect(sides.filter((x) => x > 0)).toHaveLength(5);
  async function checkHousePosition() {
    const art = (await house.boundingBox())!;
    const postcode = (await label.boundingBox())!;
    expect(
      Math.abs(art.x + art.width / 2 - (postcode.x + postcode.width / 2)),
    ).toBeLessThan(1);
    expect(postcode.y - (art.y + art.height)).toBeCloseTo(8, 0);
  }
  await checkHousePosition();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await checkHousePosition();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(trees).toHaveCount(10);
  await checkHousePosition();
  const map = (await page.locator(".map-canvas").boundingBox())!;
  for (const tree of await trees.all()) {
    const box = (await tree.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(map.x);
    expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width);
  }
  await page.screenshot({
    path: "test-results/postcode-scene-mobile.png",
    fullPage: true,
  });
});

test("Resprite house and trees play source frames and respect reduced motion", async ({
  page,
}) => {
  await demoLogin(page);
  const house = page.locator(
    '.map-decoration[data-asset-type="house"] .map-sprite',
  );
  await expect(house).toBeVisible();
  const timeline = await house.evaluate((element) => {
    const animation = element
      .getAnimations()
      .find((item) => item.id === "sprite-timeline")!;
    animation.pause();
    animation.currentTime = 0;
    const first = getComputedStyle(element).backgroundPosition;
    animation.currentTime = 375;
    const fifth = getComputedStyle(element).backgroundPosition;
    return {
      first,
      fifth,
      duration: animation.effect!.getTiming().duration,
      rendering: getComputedStyle(element).imageRendering,
      width: parseFloat(getComputedStyle(element).width),
    };
  });
  expect(timeline.first).toBe("0px 0px");
  expect(timeline.fifth).toBe("-384px 0px");
  expect(timeline.duration).toBeCloseTo((1000 * 8) / 12);
  expect(timeline.rendering).toBe("pixelated");
  expect(timeline.width).toBe(96);
  const tree = page
    .locator('.map-decoration[data-asset-type="tree"] .map-sprite')
    .first();
  await expect(tree).toHaveCSS("background-image", /tree-sprite\.svg/);
  const treeDuration = await tree.evaluate(
    (element) => element.getAnimations()[0].effect!.getTiming().duration,
  );
  expect(treeDuration).toBeCloseTo(750);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => house.evaluate((element) => element.getAnimations().length))
    .toBe(0);
  await expect(house).toHaveCSS("background-position", "0px 0px");
  await expect
    .poll(() => tree.evaluate((element) => element.getAnimations().length))
    .toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect
    .poll(() => house.evaluate((element) => element.getAnimations().length))
    .toBe(1);
});

test("protected routes redirect, credentials validate, and sessions survive refresh", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL("/login");
  await expect(page.locator(".auth-header")).toHaveCSS(
    "background-color",
    "rgb(227, 0, 39)",
  );
  await page.getByLabel("Email address").fill("demo@greentogether.test");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("don’t match");
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.reload();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH3 9GD");
  await page.getByRole("link", { name: "My Account" }).click();
  await expect(
    page.getByRole("heading", { name: "My Account." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/");
  await expect(page).toHaveURL("/login");
});

test("completion updates score, history, and map while measured values remain unchanged", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Worker failed"))
      errors.push(message.text());
  });
  const worker = page.waitForResponse((response) =>
    response.url().endsWith("/maplibre/maplibre-gl-shared.mjs"),
  );
  await demoLogin(page);
  expect((await worker).ok()).toBe(true);
  await expect(page.locator(".score-ring strong")).toHaveText("68");
  await expect(page.locator(".map-postcode-label.selected")).toContainText(
    "EH3 9GD",
  );
  const before = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("pl-green-together-demo-v1")!,
    ).communities.find((c: { id: string }) => c.id === "eh3-9gd"),
  );
  await page.getByRole("button", { name: /Air quality.*Doing well/ }).click();
  await expect(page.getByText("7 µg/m³", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Postcode overview" }).click();
  await page.getByRole("button", { name: /Air quality.*Doing well/ }).click();
  await page.getByRole("button", { name: /Explore EH3 9GD/ }).click();
  await expect(page.locator(".score-ring strong")).toHaveText("68");
  await page.getByRole("button", { name: "Take this action" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Complete action", exact: true })
    .click();
  await expect(
    dialog.getByText("Please confirm that you completed this action."),
  ).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Complete action", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Look what we’re growing." }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Back to my neighbourhood" })
    .click();
  await expect(page.locator(".score-ring strong")).toHaveText("69");
  await expect(
    page.locator('.map-decoration[data-asset-type="house"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.map-decoration[data-asset-type="tree"]'),
  ).toHaveCount(7);
  const after = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem("pl-green-together-demo-v1")!,
    ).communities.find((c: { id: string }) => c.id === "eh3-9gd"),
  );
  expect(after.indicators).toEqual(before.indicators);
  expect(after.progress.totalActions).toBe(before.progress.totalActions + 1);
  await page.screenshot({
    path: "test-results/desktop-community.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "My Account" }).click();
  await expect(page.locator(".history-list")).toContainText(
    "Take the scenic route",
  );
  await page.reload();
  await expect(page.locator(".history-list")).toContainText(
    "Take the scenic route",
  );
  expect(errors).toEqual([]);
});

test("neighbouring communities show their own house and score-based trees when selected", async ({
  page,
}) => {
  await demoLogin(page);
  await expect(page.locator(".map-postcode-label")).toHaveCount(3);
  await expect(
    page.locator('.map-decoration[data-community-id="eh3-9gd"]'),
  ).toHaveCount(8);
  await expect(
    page.locator('.map-decoration[data-community-id="eh3-9fg"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.map-decoration[data-community-id="eh8-9lj"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Explore EH3 9FG/ }).click();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH3 9FG");
  await expect(page.locator(".score-ring strong")).toHaveText("82");
  await expect(page.locator(".map-postcode-label.selected")).toContainText(
    "EH3 9FG",
  );
  await expect(
    page.locator('.map-decoration[data-community-id="eh3-9gd"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.map-decoration[data-community-id="eh3-9fg"]'),
  ).toHaveCount(10);
  await expect(
    page.locator('.map-decoration[data-asset-type="solar-panel"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Explore all actions" }).click();
  await expect(page.locator(".neighbour-note")).toContainText(
    "Your actions contribute to your own community",
  );
  await expect(page.locator(".action-card").first()).toBeDisabled();
  await page.getByRole("button", { name: "Back to my postcode" }).click();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH3 9GD");
  await page.getByRole("button", { name: /Explore EH8 9LJ/ }).click();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH8 9LJ");
  await expect(
    page.locator('.map-decoration[data-community-id="eh3-9gd"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.map-decoration[data-community-id="eh3-9fg"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('.map-decoration[data-community-id="eh8-9lj"]'),
  ).toHaveCount(6);
  await expect(
    page.locator('.map-decoration[data-asset-type="solar-panel"]'),
  ).toHaveCount(0);
});

test("signup restricts supported postcodes and text/photo proof validates", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Jamie Meadow");
  await page.getByLabel("Email address").fill("jamie@example.test");
  await page.getByLabel("Your postcode").fill("SW1A 1AA");
  await page.getByLabel("Password", { exact: true }).fill("LovelyNeighbour1!");
  await page.getByRole("button", { name: "Let’s grow together" }).click();
  await expect(
    page.getByText("Choose a supported postcode listed below."),
  ).toBeVisible();
  await page.getByRole("button", { name: "EH3 9GD", exact: true }).click();
  await page.getByRole("button", { name: "Let’s grow together" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Explore all actions" }).click();
  await page.getByRole("button", { name: /Give peak hours a break/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Complete action", exact: true })
    .click();
  await expect(dialog.getByText(/at least 10 characters/)).toBeVisible();
  await dialog
    .getByLabel("What did you change?")
    .fill("Moved laundry to the morning.");
  await dialog
    .getByRole("button", { name: "Complete action", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Look what we’re growing." }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Back to my neighbourhood" })
    .click();
  await page
    .getByRole("button", { name: /Make room for something green/ })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Complete action", exact: true })
    .click();
  await expect(dialog.getByText("Please choose a photo.")).toBeVisible();
  await dialog.getByLabel("Add a photo of your action").setInputFiles({
    name: "plant.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aUe8AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog
    .getByRole("button", { name: "Complete action", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Look what we’re growing." }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Back to my neighbourhood" })
    .click();
  await expect(
    page.getByRole("button", { name: /Make room for something green/ }),
  ).toBeDisabled();
});

test("mobile drawer, reduced motion, provider failure and keyboard modal dismissal work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
  await demoLogin(page);
  await expect(page.getByText(/Street tiles are unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /EH3 9GD · Green Score 68/ }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: /EH3 9GD · Green Score 68/ }).click();
  await expect(
    page.getByRole("button", { name: /EH3 9GD · Green Score 68/ }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-community.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Take this action" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Take this action" }),
  ).toBeFocused();
});
