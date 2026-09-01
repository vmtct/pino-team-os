import { expect, test } from "@playwright/test";

const SESSION_KEY = "pino.prototype.pnr-ward.session-choice.v1";
const ADMIN_KEY = "pino.prototype.pnr-ward.f1-team.v1";

test("TOS session choice is fixed to one mutation per visit", async ({ page }) => {
  await page.goto("/pinoria/wardrobe-prototype?learnerId=lrn_bo&learnerName=B%C6%A1&visitId=visit_e2e_001");
  await page.evaluate((key) => localStorage.removeItem(key), SESSION_KEY);
  await page.reload();
  await expect(page.getByText("Phiếu chọn 1 món")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Chọn số/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Chọn số 2" }).click();
  await expect(page.getByText(/Đã áp dụng món số 2/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Chọn số 1" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Chọn số 3" })).toBeDisabled();
  await page.reload();
  await expect(page.getByText(/Đã áp dụng món số 2/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Đã chọn" })).toBeDisabled();
});

test("a new visit gets an unused session choice", async ({ page }) => {
  await page.goto("/pinoria/wardrobe-prototype?learnerId=lrn_bo&learnerName=B%C6%A1&visitId=visit_e2e_002");
  await expect(page.getByRole("button", { name: "Chọn số 1" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Chọn số 2" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Chọn số 3" })).toBeEnabled();
});

test("BO wardrobe keeps flexible admin operations separate from TOS session limit", async ({ page }) => {
  await page.goto("/pinoria/wardrobe-admin-prototype?learnerId=lrn_bo");
  await page.evaluate((key) => localStorage.removeItem(key), ADMIN_KEY);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Wardrobe Admin · Bơ" })).toBeVisible();
  await page.getByRole("button", { name: /Gương mặt Mỉm Cười/ }).click();
  await page.getByRole("button", { name: "Trang bị" }).click();
  await expect(page.getByText(/đã được trang bị/)).toBeVisible();
  await page.getByRole("button", { name: /Tóc Cơ Bản/ }).click();
  await page.getByRole("button", { name: "Trang bị" }).click();
  await expect(page.getByText(/Tóc Cơ Bản đã được trang bị/)).toBeVisible();
});
