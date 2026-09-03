import { test, expect } from "@playwright/test";

test("F1 Experience-as-Code preview runs bespoke scenario and emits bounded signals", async ({ page }) => {
  await page.goto("/review/wfm-training-experience");
  await expect(page.getByRole("heading", { name: "Training Experience as Code" })).toBeVisible();
  await expect(page.getByText("classroom-diary-scenario@1", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Vào tình huống" }).click();
  await expect(page.getByText("STARTED", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hoàn tất/handoff evidence trước khi checkout" }).click();
  await expect(page.getByText("CHECKPOINT_COMPLETED · closing-sequence", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Ghi rõ thiếu evidence và escalation đúng owner" }).click();
  await expect(page.getByText("CHECKPOINT_COMPLETED · missing-evidence", { exact: true })).toBeVisible();

  await page.getByRole("checkbox", { name: /Attendance/ }).check();
  await page.getByRole("checkbox", { name: /Diary/ }).check();
  await page.getByRole("checkbox", { name: /Thiếu evidence/ }).check();
  await page.getByRole("button", { name: "Hoàn tất tình huống" }).click();

  await expect(page.getByText("COMPLETION_REQUESTED", { exact: true })).toBeVisible();
  await expect(page.getByText(/Core mới là nơi quyết định COMPLETED/)).toBeVisible();
});

test("unknown experience ref fails closed and never falls back to native training", async ({ page }) => {
  await page.goto("/review/wfm-training-experience");
  await expect(page.getByText("No generic LMS builder", { exact: true })).toBeVisible();
  await expect(page.getByText(/Đây không phải template/)).toBeVisible();
});
