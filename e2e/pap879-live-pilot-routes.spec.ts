import { expect, test } from "@playwright/test";

/**
 * PAP-512 #15695: real React routes only. No page.setContent, no fake Core
 * responses, no production-default Playwright base URL.
 * Run with PAP879_LOCAL_BASE_URL=http://127.0.0.1:<port> and an authenticated
 * isolated BO staging actor via PAP879_AUTH_STATE=<path> if needed.
 */
const localBase = process.env.PAP879_LOCAL_BASE_URL;
const authState = process.env.PAP879_AUTH_STATE;
const safeLocal = !!localBase && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(localBase);
test.skip(!safeLocal || !authState, "Requires explicit localhost BO staging URL and authenticated actor storage state; never tests production implicitly.");

test.use({ baseURL: safeLocal ? localBase : "http://127.0.0.1:1", ...(authState ? { storageState: authState } : {}) });

for (const entry of [
  { path: "/bo/learners", title: "Học viên", caption: "School Students directory" },
  { path: "/bo/running-classes", title: "Classes", caption: "Running Classes" },
]) {
  test(`authenticated live BO route renders canonical grid: ${entry.path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(entry.path, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/(?:staff-login|login)\b/);
    await expect(page.getByRole("heading", { name: entry.title })).toBeVisible();
    await expect(page.getByRole("table", { name: entry.caption })).toBeVisible();
    expect(errors, "No JS runtime exceptions").toEqual([]);
  });
}
