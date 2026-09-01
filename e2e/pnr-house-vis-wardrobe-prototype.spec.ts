import { expect, test } from "@playwright/test";

const STORAGE = "pino.prototype.pnr-ward.session-choice.v1";
const VISIT = "visit_house_vis_e2e_001";
const TV = `/pinoria-tv/wardrobe-prototype?learnerId=lrn_bo&learnerName=B%C6%A1&visitId=${VISIT}`;
const TOS = `/pinoria/wardrobe-prototype?learnerId=lrn_bo&learnerName=B%C6%A1&visitId=${VISIT}`;

test("TV and TOS share the same fixed 1-2-3 session choice", async ({ context }) => {
  const tv = await context.newPage();
  await tv.goto(TV);
  await tv.evaluate((key) => localStorage.removeItem(key), STORAGE);
  await tv.reload();

  const cards = tv.locator("article");
  await expect(cards).toHaveCount(3);
  await expect(tv.getByRole("img", { name: "Pinoria" })).toHaveAttribute("src", /Pinoria%20Logo\.png/);
  await expect(tv.getByLabel("Mori")).toBeVisible();
  await expect(tv.locator("[data-character-accessory-slot]")).toHaveCount(8);
  await expect(tv.locator('[data-pinoria-character-effect="aura-back"]')).toBeVisible();
  await expect(tv.locator('[data-pinoria-character-effect="aura-ground"]')).toBeVisible();
  await expect(tv.locator('[data-pinoria-character-orbit-mark]')).toHaveCount(3);
  await expect(tv.getByText(/Thầy Cô/).first()).toBeVisible();
  await expect(tv.getByText(/staff/i)).toHaveCount(0);
  await expect.poll(async () => tv.locator('[data-pinoria-character-orbit-depth="front"]').count()).toBeGreaterThan(0);
  await expect.poll(async () => tv.locator('[data-pinoria-character-orbit-depth="behind"]').count()).toBeGreaterThan(0);
  const depth = await tv.evaluate(() => {
    const core = document.querySelector<HTMLElement>("[data-pinoria-character-core]")!;
    const front = document.querySelector<HTMLElement>('[data-pinoria-character-orbit-depth="front"]')!;
    const behind = document.querySelector<HTMLElement>('[data-pinoria-character-orbit-depth="behind"]')!;
    return {
      core: Number(getComputedStyle(core).zIndex),
      front: Number(getComputedStyle(front).zIndex),
      behind: Number(getComputedStyle(behind).zIndex),
    };
  });
  expect(depth.front).toBeGreaterThan(depth.core);
  expect(depth.behind).toBeLessThan(depth.core);

  await expect(cards.nth(0)).toContainText("Nón Sinh Nhật");
  await expect(cards.nth(1)).toContainText("Gương mặt Mỉm Cười");
  await expect(cards.nth(2)).toContainText("Gương mặt Tinh Nghịch");

  const tos = await context.newPage();
  await tos.goto(TOS);
  await tos.getByRole("button", { name: "Chọn số 2" }).click();
  await expect(tos.getByRole("button", { name: "Xác nhận số 2" })).toBeVisible();
  await expect(tv.getByText("ĐÃ CHỌN")).toHaveCount(0);
  await tos.getByRole("button", { name: "Xác nhận số 2" }).click();
  await expect(tos.getByText(/Đã áp dụng món số 2/)).toBeVisible();
  await expect(tv.getByText("ĐÃ CHỌN", { exact: true })).toBeVisible();
  await expect(tv.getByText(/Tủ đồ đã cập nhật/)).toBeVisible();
  await expect(cards.nth(1)).toContainText("Gương mặt Mỉm Cười");
  await expect(tv.getByLabel("Mori")).toBeVisible();

  await tv.reload();
  await expect(tv.getByText("ĐÃ CHỌN", { exact: true })).toBeVisible();
  await expect(tv.getByText("Đã cập nhật nhân vật")).toBeVisible();
  await expect(tv.getByLabel("Mori")).toBeVisible();
});
