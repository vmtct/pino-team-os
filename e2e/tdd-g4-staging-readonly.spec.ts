import fs from "node:fs";
import { test, expect, type Browser } from "@playwright/test";
import { G4_BO_ORIGIN, G4_HO_ORIGIN, g4SubscriptionUrl, validateG4RunnerEnv, type G4RunnerEnv } from "../lib/tdd-g4-staging-config";

/**
 * PAP-1074 partial read-only G4 acceptance suite. Run ONLY via the explicit
 * tdd:g4:readonly command. Never use production, shared Chrome/CDP, fake auth,
 * mock APIs, synthetic payroll/subscription writes or non-staging endpoints.
 */
const enabled = process.env.TDD_G4_RUN === "1";
test.skip(!enabled, "PAP-1074 requires explicit tdd:g4:readonly command; skip is never G4 acceptance");
const configErrors = validateG4RunnerEnv(process.env as G4RunnerEnv);
const subscriptionId = process.env.TDD_G4_SUBSCRIPTION_ID ?? "";
const founderState = process.env.TDD_G4_FOUNDER_STATE ?? "";
const managerState = process.env.TDD_G4_MANAGER_STATE ?? "";

function prerequisites() {
  expect(configErrors, "G4 admission must be complete (no skip/waiver)").toEqual([]);
  expect(fs.existsSync(founderState), "Founder storage state must exist privately").toBe(true);
  expect(fs.existsSync(managerState), "Manager storage state must exist privately").toBe(true);
}
async function rolePage(browser: Browser, role: "founder" | "manager") {
  const context = await browser.newContext({
    storageState: role === "founder" ? founderState : managerState,
  });
  return { context, page: await context.newPage() };
}

test("G4 admission requires real private role fixtures and exact Staging deployment", () => prerequisites());

test("unauthenticated BO/HO access redirects to sign-in", async ({ browser }) => {
  prerequisites();
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    for (const url of [G4_BO_ORIGIN + "/bo?module=subscriptions", G4_HO_ORIGIN + "/ho/staff"]) {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page, "anonymous sensitive route cannot be rendered").toHaveURL(/\/staff-login(?:\?|$)/);
      await page.close();
    }
  } finally { await context.close(); }
});

test("authenticated Founder sees HO Staff canonical TDD page (no fake data)", async ({ browser }) => {
  prerequisites();
  const { context, page } = await rolePage(browser, "founder");
  try {
    await page.goto(G4_HO_ORIGIN + "/ho/staff", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/staff-login/);
    await expect(page.locator("main").first()).toBeVisible();
    expect(await page.evaluate(() => document.body.innerText.length)).toBeGreaterThan(50);
  } finally { await context.close(); }
});

test("Founder Subscription record URL persists across reload at five viewports", async ({ browser }) => {
  prerequisites();
  const { context, page } = await rolePage(browser, "founder");
  const url = g4SubscriptionUrl(subscriptionId);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/staff-login/);
    await expect(page.locator('[data-bo-runtime-surface="subscriptions-core"]')).toBeVisible();
    await expect(page).toHaveURL(new RegExp("record=" + subscriptionId, "i"));
    // This must be a REAL resolved detail, not an invalid-but-well-formed UUID
    // whose URL was preserved while the application shows an error.
    await expect(page.locator('[data-tdd-shell="detail"] #detail-subtitle')).toHaveText(subscriptionId);
    await expect(page.getByRole("tab", { name: "Thông Tin" })).toHaveAttribute("aria-selected", "true");
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-bo-runtime-surface="subscriptions-core"]')).toBeVisible();
      await expect(page).toHaveURL(new RegExp("record=" + subscriptionId, "i"));
      await expect(page.locator('[data-tdd-shell="detail"] #detail-subtitle')).toHaveText(subscriptionId);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), "no horizontal page overflow").toBeLessThanOrEqual(width + 2);
    }
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.getByRole("tab", { name: "Enrollment" }).click();
    await expect(page).toHaveURL(/tab=enrollment/);
    await expect(page.getByRole("tab", { name: "Enrollment" })).toHaveAttribute("aria-selected", "true");
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp("record=" + subscriptionId, "i"));
    await expect(page.getByRole("tab", { name: "Thông Tin" })).toHaveAttribute("aria-selected", "true");
    await page.goForward({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/tab=enrollment/);
    await expect(page.getByRole("tab", { name: "Enrollment" })).toHaveAttribute("aria-selected", "true");
  } finally { await context.close(); }
});

test("Manager denied Subscription subject, not replaced with fabricated records", async ({ browser }) => {
  prerequisites();
  const { context, page } = await rolePage(browser, "manager");
  const responses: number[] = [];
  page.on("response", r => {
    const u = new URL(r.url());
    if (u.origin === G4_BO_ORIGIN && u.pathname.startsWith("/api/bo/") && [401, 403].includes(r.status())) responses.push(r.status());
  });
  try {
    await page.goto(g4SubscriptionUrl(subscriptionId), { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    expect(responses, "real authorized BO API must return 401/403 for Manager, not just hide buttons").toContain(403);
  } finally { await context.close(); }
});

test("invalid record ID is not displayed as an existing Subscription", async ({ browser }) => {
  prerequisites();
  const { context, page } = await rolePage(browser, "founder");
  try {
    await page.goto(G4_BO_ORIGIN + "/bo?module=subscriptions&record=not-a-uuid", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/staff-login/);
    await expect(page.locator('[data-bo-runtime-surface="subscriptions-core"]')).toBeVisible();
    // A malformed ID must never enter the full detail record view.
    await expect(page.locator('[data-bo-runtime-surface="subscriptions-core"] [data-bo-full-detail]')).toHaveCount(0);
  } finally { await context.close(); }
});
