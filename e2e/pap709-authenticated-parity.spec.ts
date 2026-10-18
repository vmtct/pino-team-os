import { test, expect } from "@playwright/test";

/**
 * PAP-709: authenticated UI parity checks against approved PAP-686/PAP-699.
 * Requires a real staff storage state. Never pass this suite using fabricated auth or role facts.
 * Screenshots are evidence for human comparison, not automatic visual approval.
 */
const storageState = process.env.E2E_TOS_AUTH_STORAGE_STATE;
test.skip(!storageState, "Authenticated E2E_TOS_AUTH_STORAGE_STATE required for PAP-709 visual evidence");
test.use(storageState ? { storageState } : {});

for (const width of [390, 768, 1440]) {
  test.describe("PAP-709 authentic Home and Ca Làm at " + width, () => {
    test.use({ viewport: { width, height: 900 } });

    test("Home uses a centered 430px-max canvas, fixed apps and no horizontal overflow", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();
      await expect(page.getByRole("region", { name: "Ứng dụng PINO" })).toBeVisible();
      const tileNames = ["Ca làm", "Tiếp tân", "Trạm TOS", "Trưởng ca", "Lớp học"];
      const tiles = page.locator("button[aria-label^='Mở '],button[aria-label$=' chưa có quyền']");
      await expect(tiles).toHaveCount(5);
      for (let i = 0; i < tileNames.length; i++) await expect(tiles.nth(i)).toContainText(tileNames[i]);
      const bounds = await page.locator("main").first().boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeLessThanOrEqual(width);
      const panel = await page.locator("main > div").last().boundingBox();
      expect(panel).not.toBeNull();
      expect(panel!.width).toBeLessThanOrEqual(431);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: "test-results/pap709-home-" + width + ".png", fullPage: true });
    });

    test("Ca Làm has compact Back and exactly four contextual tabs", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByRole("link", { name: "Quay về TOS Home" })).toBeVisible();
      const tabs = [
        { name: "Hôm nay", href: "/dashboard" },
        { name: "Lịch ca", href: "/schedule" },
        { name: "Giờ công", href: "/timesheet" },
        { name: "Thu nhập", href: "/earnings" },
      ];
      for (const tab of tabs) {
        const link = page.getByRole("navigation").getByRole("link", { name: tab.name, exact: true });
        await expect(link).toBeVisible();
        await link.click();
        await expect(page).toHaveURL(new RegExp(tab.href + "$"));
        await expect(page.getByRole("link", { name: "Quay về TOS Home" })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await page.screenshot({ path: "test-results/pap709-" + tab.href.slice(1) + "-" + width + ".png", fullPage: true });
      }
    });
  });
}
