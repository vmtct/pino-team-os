import { test, expect } from "@playwright/test";

test("PINO Photo Mission teaches visual decisions and completes through bounded signals", async ({ page }) => {
  await page.goto("/review/wfm-training-photo", { waitUntil: "domcontentloaded" });
  await expect(page.locator(`main[data-hydrated="true"]`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chụp PINO đẹp", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mở camera" }).click();

  await page.getByText("Shot B", { exact: true }).first().click();
  await expect(page.getByText(/Hạ camera xuống ngang tầm trẻ/)).toBeVisible();

  await page.getByText("Shot B", { exact: true }).last().click();
  await expect(page.getByText(/Một ít bàn học, vật liệu/)).toBeVisible();

  const checks = page.getByRole("checkbox");
  await expect(checks).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) await checks.nth(index).check();

  await page.getByRole("button", { name: "Tôi sẵn sàng chụp" }).click();
  await expect(page.getByText("Mission hoàn tất.", { exact: true })).toBeVisible();
  await expect(page.getByText("CHECKPOINT_COMPLETED · eye-level-story", { exact: true })).toBeVisible();
  await expect(page.getByText("CHECKPOINT_COMPLETED · pino-context", { exact: true })).toBeVisible();
  await expect(page.getByText("CHECKPOINT_COMPLETED · pre-shutter-scan", { exact: true })).toBeVisible();
  await expect(page.getByText("COMPLETION_REQUESTED", { exact: true })).toBeVisible();
});
