import { expect, test, type Page } from "@playwright/test";

async function demoLogin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH3 9GD");
}

test("protected routes redirect, credentials validate, and sessions survive refresh", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL("/login");
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
  const bounds = await page.locator(".map-canvas").boundingBox();
  await page.mouse.click(
    bounds!.x + bounds!.width / 2 + 45,
    bounds!.y + bounds!.height / 2 + 60,
  );
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
  await expect(page.locator(".asset-unlocked")).toHaveCount(1);
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

test("neighbouring communities have their own map assets and actions remain local", async ({
  page,
}) => {
  await demoLogin(page);
  await page.getByLabel("Explore a postcode").selectOption("eh3-9fg");
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH3 9FG");
  await expect(page.locator(".score-ring strong")).toHaveText("82");
  await expect(page.locator(".map-postcode-label.selected")).toContainText(
    "EH3 9FG",
  );
  await page.getByRole("button", { name: "Explore all actions" }).click();
  await expect(page.locator(".neighbour-note")).toContainText(
    "Your actions contribute to your own community",
  );
  await expect(page.locator(".action-card").first()).toBeDisabled();
  await page.getByRole("button", { name: "Back to my postcode" }).click();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH3 9GD");
  await page.getByRole("button", { name: /Explore EH8 9LJ/ }).click();
  await expect(page.locator(".sidebar-identity h2")).toHaveText("EH8 9LJ");
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
  await dialog
    .getByLabel("Add a photo of your action")
    .setInputFiles({
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
