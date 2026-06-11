import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API_BASE = "http://127.0.0.1:5173";
const PASSWORD = "SmokePass123!";

function projectLocale(name: string): "zh" | "en" {
  return name.includes("-en-") ? "en" : "zh";
}

function projectTheme(name: string): "light" | "dark" {
  return name.includes("-dark") ? "dark" : "light";
}

async function createUser(request: APIRequestContext, email: string, name: string): Promise<string> {
  const start = await request.post(`${API_BASE}/api/auth/register/start`, {
    data: { email, name, password: PASSWORD }
  });
  if (!start.ok()) {
    const login = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email, password: PASSWORD }
    });
    expect(login.ok()).toBeTruthy();
    const body = await login.json() as { token?: string };
    expect(body.token).toBeTruthy();
    return body.token!;
  }
  const pending = await start.json() as { pendingId: string; devCode?: string };
  expect(pending.devCode).toMatch(/^\d{6}$/);

  const verify = await request.post(`${API_BASE}/api/auth/register/verify`, {
    data: { pendingId: pending.pendingId, code: pending.devCode }
  });
  expect(verify.ok()).toBeTruthy();
  const body = await verify.json() as { token: string };
  return body.token;
}

async function applyClientPrefs(page: Page, locale: "zh" | "en", theme: "light" | "dark") {
  await page.addInitScript(({ locale, theme }) => {
    localStorage.setItem("envforge_locale", locale);
    localStorage.setItem("envforge_theme", theme);
  }, { locale, theme });
}

async function assertHealthyPage(page: Page) {
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator("body")).not.toContainText(/TypeError|ReferenceError|Cannot read|Failed to fetch|Unhandled/i);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBeFalsy();
}

test.describe("EnvForge web smoke", () => {
  test("anonymous public/auth routes render", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const locale = projectLocale(testInfo.project.name);
    const theme = projectTheme(testInfo.project.name);
    await applyClientPrefs(page, locale, theme);

    for (const route of ["/", "/login", "/register"]) {
      await page.goto(route);
      await assertHealthyPage(page);
      await expect(page.getByText("EnvForge").first()).toBeVisible();
    }

    expect(errors).toEqual([]);
    if (process.env.PW_SNAPSHOT === "1") {
      await expect(page).toHaveScreenshot(`anonymous-${testInfo.project.name}.png`, { fullPage: true });
    }
  });

  test("user app routes render", async ({ page, request }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const locale = projectLocale(testInfo.project.name);
    const theme = projectTheme(testInfo.project.name);
    await applyClientPrefs(page, locale, theme);
    const token = await createUser(request, `codex-ui-${Date.now()}-${testInfo.workerIndex}@example.test`, "Codex UI Smoke");

    await page.goto(`/#token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    for (const route of ["/app/dashboard", "/app/migrate", "/app/build", "/app/plans", "/app/reports"]) {
      await page.goto(route);
      await assertHealthyPage(page);
      await expect(page.getByText("EnvForge").first()).toBeVisible();
    }

    expect(errors).toEqual([]);
    if (process.env.PW_SNAPSHOT === "1") {
      await expect(page).toHaveScreenshot(`user-routes-${testInfo.project.name}.png`, { fullPage: true });
    }
  });

  test("admin route renders for admin email", async ({ page, request }, testInfo) => {
    const locale = projectLocale(testInfo.project.name);
    const theme = projectTheme(testInfo.project.name);
    await applyClientPrefs(page, locale, theme);
    const email = `codex-ui-admin-${testInfo.project.name}@example.test`;
    const token = await createUser(request, email, "Codex UI Admin");

    await page.goto(`/#token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await page.goto("/app/admin");
    await assertHealthyPage(page);
    await expect(page.getByTestId("capability-admin-workbench")).toBeVisible();
  });
});
