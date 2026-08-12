import { test, expect } from "@playwright/test";

test("authenticated schedule inspect exposes live schedule data", async ({ page }) => {
  await page.goto("/api/debug/schedule-inspect");
  const response = await page.locator("body").innerText();
  const body = JSON.parse(response);

  expect(body.ok).toBe(true);
  expect(body.week.name).toBe("26B(11)");
  expect(body.week.startResolved).toBe("2026-08-10");
  expect(body.result.currentWeek).toBe(true);
  expect(body.days.Monday.shiftIds.length).toBeGreaterThan(0);
  expect(body.days.Wednesday.shiftIds.length).toBeGreaterThan(0);
  expect(body.days.Wednesday.shifts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "S2", start: "09:30", end: "11:30" }),
    ]),
  );
});
