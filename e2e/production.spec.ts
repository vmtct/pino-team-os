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

  test("invalid staff token is rejected", async ({ request }) => {
    const response = await request.get("/schedule?t=definitely-not-a-real-staff-key", { maxRedirects: 0 });
    expect([200, 404]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.text();
      expect(body).toContain("Staff link không hợp lệ");
    }
  });

  test("live staff token renders current schedule", async ({ page }) => {
    const username = process.env.STAFF_E2E_USERNAME;
    test.skip(!username, "STAFF_E2E_USERNAME is not configured");
    const response = await page.goto(`/schedule?t=${encodeURIComponent(username!)}`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toContainText("Văn Minh Trị");
    await expect(page.locator("body")).toContainText("26B(11)");
    await expect(page.locator("body")).toContainText("09:30 — 11:30");
    await expect(page.locator("body")).toContainText("S2");
  });
});
