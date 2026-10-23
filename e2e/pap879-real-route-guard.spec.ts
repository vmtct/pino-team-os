import { test, expect } from "@playwright/test";

/**
 * PAP-512 #15695: authenticated, Core-backed pre-stage pilot smoke.
 * NEVER fall back to production, HTML fixtures, mocked API, or synthetic auth.
 * Run only on a local i5 staging-isolated Next.js process with seeded Manager/Staff.
 */
const target = process.env.PAP879_LOCAL_BO_URL;
const safeLocal = (() => {
  if (!target) return false;
  try {
    const u = new URL(target);
    return u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname);
  } catch { return false; }
})();
test.skip(!safeLocal, "Explicit PAP879_LOCAL_BO_URL=http://127.0.0.1:<local-port> required; never hit production.");

for (const [route, heading] of [["/bo/learners", "Học viên"], ["/bo/running-classes", "Classes"]] as const) {
  test(`PAP-879 real authenticated BO route ${route}`, async ({ page }) => {
    const apiResponses: number[] = [];
    page.on("response", response => {
      if (new URL(response.url()).pathname === "/api/bo/context") apiResponses.push(response.status());
    });
    await page.goto(new URL(route, target).toString());
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();
    expect(apiResponses, "session context must be served by real same-origin API").toContain(200);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator("table").first()).toBeVisible();
      // Capture evidence only: no unapproved golden baseline update.
      await page.screenshot({ path: `test-results/pap879-${route.split("/").at(-1)}-${width}.png`, fullPage: true });
    }
  });
}
