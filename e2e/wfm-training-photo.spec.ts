import { test, expect, type Page } from "@playwright/test";

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n7sAAAAASUVORK5CYII=", "base64");

async function reachSubmission(page: Page, fileName: string) {
  await page.goto("/review/wfm-training-photo", { waitUntil: "domcontentloaded" });
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible();
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Mở camera" }).click();
  await page.getByText("Shot B", { exact: true }).first().click();
  await page.getByText("Shot B", { exact: true }).last().click();
  const checks = page.getByRole("checkbox");
  await expect(checks).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) await checks.nth(index).check();
  await page.getByTestId("photo-input").setInputFiles({ name: fileName, mimeType: "image/png", buffer: tinyPng });
  await expect(page.getByAltText("Ảnh training Staff chuẩn bị submit")).toBeVisible();
  await page.getByRole("button", { name: "Submit để Manager review" }).click();
  await expect(page.getByText("WAITING REVIEW", { exact: true })).toBeVisible();
}

test("PINO Photo Mission submits a real image and requires Manager PASS before completion", async ({ page }) => {
  await reachSubmission(page, "pino-class.jpg");
  await expect(page.getByRole("button", { name: "Hoàn tất training" })).toHaveCount(0);
  await expect(page.getByText(/SUBMISSION_CREATED · photo-/)).toBeVisible();
  await page.getByRole("button", { name: "Pass photo" }).click();
  const staff = page.getByRole("article");
  await expect(staff.getByText("PHOTO PASS", { exact: true })).toBeVisible();
  await expect(staff.getByText(/Góc thấp tốt/)).toBeVisible();
  await page.getByRole("button", { name: "Hoàn tất training" }).click();
  await expect(staff.getByText("Mission hoàn tất.", { exact: true })).toBeVisible();
  await expect(page.getByText("COMPLETION_REQUESTED", { exact: true })).toBeVisible();
});
test("Manager RETRY keeps completion locked and gives Staff actionable feedback", async ({ page }) => {
  await reachSubmission(page, "retry.jpg");
  await page.getByRole("button", { name: "Needs retry" }).click();
  const staff = page.getByRole("article");
  await expect(staff.getByText("NEEDS RETRY", { exact: true })).toBeVisible();
  await expect(staff.getByText(/Background còn rối/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Hoàn tất training" })).toHaveCount(0);
  await page.getByRole("button", { name: "Chụp lại" }).click();
  await expect(staff.getByText("Chưa chọn ảnh", { exact: true })).toBeVisible();
});

test("mobile Photo Mission is edge-to-edge, readable and overflow-safe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/review/wfm-training-photo", { waitUntil: "domcontentloaded" });
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible();
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chụp PINO đẹp", exact: true })).toBeVisible();

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

  const openCamera = page.getByRole("button", { name: "Mở camera" });
  const box = await openCamera.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await openCamera.click();
  await expect(page.getByText("01 · CAMERA HEIGHT", { exact: true })).toBeVisible();
});

test("mobile review keeps Staff and Manager surfaces separated", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/review/wfm-training-photo", { waitUntil: "domcontentloaded" });
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chụp PINO đẹp", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ảnh thực hành", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Manager review", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ảnh thực hành", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chụp PINO đẹp", exact: true })).toBeHidden();
});
