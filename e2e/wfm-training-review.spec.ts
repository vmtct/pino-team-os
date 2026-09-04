import { test, expect } from "@playwright/test";

test.describe("WFM-TRAIN local review", () => {
  test("Staff TOS and Manager BO prototype remain interactive", async ({ page }) => {
    await page.goto("/review/wfm-training");
    await expect(page.getByRole("heading", { name: "Skill Passport" })).toBeVisible();
    await expect(page.getByText("Classroom Diary & Closing", { exact: true })).toBeVisible();

    const continueButtons = page.getByRole("button", { name: "Tiếp tục học" });
    await expect(continueButtons).toHaveCount(2);
    await continueButtons.first().click();
    await expect(continueButtons).toHaveCount(1);

    await page.getByRole("button", { name: "BO · Builder" }).click();
    await expect(page.getByRole("heading", { name: "Tạo training" })).toBeVisible();
    await page.getByRole("button", { name: "＋ Thêm bài học" }).click();
    await expect(page.getByText("Bài học 5", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Review & Publish" }).click();
    await expect(page.getByText(/Version 1 đã được đóng băng/)).toBeVisible();
  });
});
