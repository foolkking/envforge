import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API_BASE = "http://127.0.0.1:5174";
const PASSWORD = "SmokePass123!";
const SMOKE_RUN_ID = process.env.ENVFORGE_SMOKE_RUN_ID ?? "local";

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
    const email = `codex-ui-admin-${SMOKE_RUN_ID}-${testInfo.project.name}@example.test`;
    const token = await createUser(request, email, "Codex UI Admin");

    await page.goto(`/#token=${encodeURIComponent(token)}`);
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await page.goto("/app/admin");
    await assertHealthyPage(page);
    await expect(page.getByTestId("capability-admin-workbench")).toBeVisible();

    const catalogPreviewTab = page.getByTestId("tab-catalog-preview");
    await expect(catalogPreviewTab).toHaveAttribute("role", "tab");
    await catalogPreviewTab.click();
    await expect(catalogPreviewTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("catalog-preview-tab")).toBeVisible();
    await expect(page.getByTestId("catalog-preview-readonly-note")).toContainText(/Runtime catalog unchanged|运行时 catalog 未改变/);
    await expect(page.getByTestId("catalog-preview-diff-review")).toBeVisible();
    await expect(page.getByTestId("catalog-preview-safety")).toBeVisible();
    await expect(page.getByTestId("catalog-preview-promotion-draft")).toContainText(/No promotion request draft|尚未生成 promotion request draft/);
    await page.getByRole("button", { name: /Generate promotion request|生成 promotion request/ }).click();
    await expect(page.getByTestId("catalog-preview-promotion-draft")).toContainText(/No runtime catalog was changed|运行时 catalog/);
    await expect(page.getByTestId("catalog-preview-promotion-draft")).toContainText(/No capability was enabled|不会启用能力|没有启用/);
    await expect(page.getByTestId("catalog-preview-promotion-draft")).toContainText(/No apply run was created|Apply Run/);
    await expect(page.getByTestId("catalog-preview-tab")).not.toContainText(/Apply an approved plan|真实 Apply/);

    const standardsTab = page.getByTestId("tab-standards");
    await expect(standardsTab).toHaveAttribute("role", "tab");
    await standardsTab.click();
    await expect(standardsTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("standards-tab")).toBeVisible();
    await expect(page.getByRole("heading", {
      name: locale === "zh" ? "版本化标准层" : "Versioned standards layer"
    })).toBeVisible();
    await assertHealthyPage(page);
  });
});
