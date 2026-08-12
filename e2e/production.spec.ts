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

  test("invalid staff username is rejected", async ({ request }) => {
    const response = await request.get("/s/definitely-not-a-real-staff-key", { maxRedirects: 0 });
    expect([404, 307, 308]).toContain(response.status());
  });

  test("live staff link renders current schedule", async ({ page }) => {
    const username = process.env.STAFF_E2E_USERNAME;
    test.skip(!username, "STAFF_E2E_USERNAME is not configured");
    const response = await page.goto(`/s/${encodeURIComponent(username!)}/schedule`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toContainText("Lịch của tôi");
    const apiResponse = await page.request.get(`/api/staff/${encodeURIComponent(username!)}/schedule`);
    expect(apiResponse.status()).toBe(200);
    const body = await apiResponse.json();
    expect(body.ok).toBe(true);
    expect(body.schedule?.weekName).toBe("26B(11)");
    expect(body.schedule?.weekStart).toContain("2026-08-10");
    expect(body.schedule?.shifts?.Monday?.length).toBeGreaterThan(0);
    expect(body.schedule?.shifts?.Wednesday).toEqual(expect.arrayContaining([expect.objectContaining({ code: "S2", startTime: "09:30", endTime: "11:30" })]));
  });
});
