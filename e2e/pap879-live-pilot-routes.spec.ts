import { expect, test } from "@playwright/test";

/** PAP-512: live React routes only; no production fallback or mocked Core. */
const localBase = process.env.PAP879_LOCAL_BASE_URL;
const authState = process.env.PAP879_AUTH_STATE;
const safeLocal = !!localBase && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(localBase);
if (process.env.PAP879_REQUIRE_E2E === "1" && (!safeLocal || !authState)) {
  throw new Error("PAP-512 E2E required, but isolated localhost URL or authenticated actor state is missing; refusing skipped green verdict.");
}
test.skip(!safeLocal || !authState, "Requires explicit localhost BO staging URL and authenticated actor storage state.");
test.use({ baseURL: safeLocal ? localBase : "http://127.0.0.1:1", ...(authState ? { storageState: authState } : {}) });

for (const entry of [
  { path: "/bo/learners", title: "Học viên", caption: "School Students directory", permission: "student.profile.view" },
  { path: "/bo/running-classes", title: "Classes", caption: "Running Classes", permission: "delivery.schedule.view" },
]) {
  for (const width of [390, 768, 1440]) {
    test(`authenticated live BO route: ${entry.path} @ ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      const actor = await page.request.get("/api/bo/context", { failOnStatusCode: false });
      expect(actor.status(), "BO actor requires authorized Core-backed context").toBe(200);
      const envelope = await actor.json() as { data?: { surface?: string; entitled?: boolean; permissionKeys?: string[] } };
      expect(envelope.data?.surface).toBe("BO");
      expect(envelope.data?.entitled).toBe(true);
      expect(envelope.data?.permissionKeys).toContain(entry.permission);
      await page.goto(entry.path, { waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/(?:staff-login|login)\b/);
      await expect(page.getByRole("heading", { name: entry.title })).toBeVisible();
      await expect(page.getByRole("table", { name: entry.caption })).toBeVisible();
      await expect(page.getByLabel("Các chế độ xem dùng chung"), "Core-authorized route must mount Shared Views runtime").toBeVisible();
      const expectedRole = process.env.PAP879_EXPECT_ROLE;
      if (expectedRole === "manager" || expectedRole === "staff") {
        expect(envelope.data?.permissionKeys?.includes("bo.shared_view.manage"), "Actor role must match Core permission" ).toBe(expectedRole === "manager");
        const createView = page.getByRole("button", { name: "Thêm view chung" });
        if (expectedRole === "manager") await expect(createView).toBeVisible();
        else await expect(createView).toHaveCount(0);
      }
      expect(errors, "No JS runtime exceptions").toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`pap879-${entry.path.split("/").pop()}-${width}.png`), fullPage: true });
    });
  }
}
