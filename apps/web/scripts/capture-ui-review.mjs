// Ad-hoc UI review screenshot capture (light + dark, public + app pages).
// Usage: node scripts/capture-ui-review.mjs  (web on 5173, api on 5174)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const WEB = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:5174";
const OUT = "screenshots/ui-review-new";
const PASSWORD = "SmokePass123!";

async function createToken() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "uiadmin@example.test", password: PASSWORD })
  });
  if (!login.ok) throw new Error(`login ${login.status}`);
  return (await login.json()).token;
}

mkdirSync(OUT, { recursive: true });
const token = await createToken();
const browser = await chromium.launch();

for (const theme of ["light", "dark"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(([t]) => {
    localStorage.setItem("envforge_locale", "zh");
    localStorage.setItem("envforge_theme", t);
  }, [theme]);
  const page = await context.newPage();

  await page.goto(`${WEB}/`);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/public-${theme}.png` });

  await page.goto(`${WEB}/login`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/login-${theme}.png` });

  await page.goto(`${WEB}/#token=${encodeURIComponent(token)}`);
  await page.waitForTimeout(1500);

  for (const route of ["dashboard", "migrate", "build", "plans", "reports"]) {
    await page.goto(`${WEB}/app/${route}`);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${OUT}/${route}-${theme}.png` });
  }
  await context.close();
}

await browser.close();
console.log("done ->", OUT);
