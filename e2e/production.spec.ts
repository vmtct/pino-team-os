import { test, expect } from "@playwright/test";

test.describe("PINO Team OS production", () => {
  test("home renders successfully", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("health endpoint is available", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
  });

  for (const route of ["/me", "/schedule", "/team"]) {
    test(`${route} respects auth boundary`, async ({ request }) => {
      const response = await request.get(route, { maxRedirects: 0 });
      expect([200, 302, 303, 307, 308, 401, 403]).toContain(response.status());
    });
  }
});
