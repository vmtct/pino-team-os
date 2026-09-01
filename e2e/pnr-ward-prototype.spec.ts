import { expect, test } from "@playwright/test";

const storageKey = "pino.prototype.pnr-ward.f1-team.v1";
test.beforeEach(async ({ page }) => {
  await page.goto("/pinoria/wardrobe-prototype");
  await page.evaluate((key) => localStorage.removeItem(key), storageKey);
  await page.reload();
  await page.waitForLoadState("networkidle");
});

test("staff can try, equip, unequip and grant without auto-equip", async ({ page }) => {
  await page.getByRole("button", { name: /Bơ/ }).click();
  await expect(page).toHaveURL(/learnerId=lrn_bo/);
  await expect(page.getByText("5 slot đang dùng")).toBeVisible();
  await page.getByRole("button", { name: /Gương mặt Mỉm Cười/ }).click();
  await expect(page.getByText("ĐANG THỬ", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Trang bị" }).click();
  await expect(page.getByText(/đã được trang bị/)).toBeVisible();
  await page.getByRole("button", { name: /Nón Sinh Nhật/ }).click();
  await page.getByRole("button", { name: "Gỡ" }).click();
  await expect(page.getByText(/đã được gỡ khỏi loadout/)).toBeVisible();
  await page.getByRole("button", { name: /Cấp món/ }).click();
  await page.locator("article").filter({ hasText: "Gương mặt Tinh Nghịch" }).getByRole("button", { name: "Cấp" }).click();
  await expect(page.getByText(/Loadout không thay đổi/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Gương mặt Tinh Nghịch", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Nón Sinh Nhật/ })).not.toContainText("Đang dùng");
});
test("switching learner never reuses the previous wardrobe state", async ({ page }) => {
  await page.getByRole("button", { name: /An/ }).click();
  await expect(page.getByText("3 wearable", { exact: true })).toBeVisible();
  await expect(page.getByText("Nón Sinh Nhật", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /An.*Đổi học viên/ }).click();
  await page.getByRole("button", { name: /Minh/ }).click();
  await expect(page.getByText("0 wearable", { exact: true })).toBeVisible();
  await expect(page.getByText("Chưa sở hữu món nào trong nhóm này.")).toBeVisible();
});
