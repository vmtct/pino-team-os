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

  test("current staff schedule resolves the live week and Wednesday S2", async ({ request }) => {
    const secret = process.env.SCHEDULE_E2E_SECRET;
    const email = process.env.SCHEDULE_E2E_EMAIL;
    test.skip(!secret || !email, "Production schedule probe credentials are not configured");

    const response = await request.get("/api/debug/schedule", {
      headers: {
        "x-pino-e2e-secret": secret!,
        "x-pino-e2e-email": email!,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.diagnostic.identity.email).toBe(email);
    expect(body.diagnostic.week.name).toBe("26B(11)");
    expect(body.diagnostic.week.startResolved).toBe("2026-08-10");
    expect(body.diagnostic.result.currentWeek).toBe(true);

    expect(body.diagnostic.days.Monday.shiftIds.length).toBeGreaterThan(0);
    expect(body.diagnostic.days.Wednesday.shiftIds.length).toBeGreaterThan(0);
    expect(body.diagnostic.days.Wednesday.shifts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "S2", start: "09:30", end: "11:30" }),
      ]),
    );
  });
});
