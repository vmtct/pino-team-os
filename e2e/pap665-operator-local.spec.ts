import { test, expect } from "@playwright/test";

const CENTER = "11111111-1111-4111-8111-111111111111";
const PRESENTATION = "22222222-2222-4222-8222-222222222222";
const CLAIM = "2026-10-19T16:50:00Z";

test("PAP-665 operator Close uses Core receipt then reads authoritative queue", async ({ page }) => {
  let completed = false;
  const captured: { path: string; body: unknown; idempotency: string | null }[] = [];
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/tos-learning/pinoria/presentations/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/").pop() ?? "";
    if (path === "queue") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        data: { current: completed ? null : { id: PRESENTATION, kind: "EGG_HATCH", claimedAt: CLAIM, projection: {} },
          queued: [], hasMore: false, revision: completed ? 2 : 1 },
      }) });
    }
    if (path === "close") {
      captured.push({
        path, body: request.postDataJSON(), idempotency: request.headers()["idempotency-key"] ?? null,
      });
      completed = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        data: { presentationId: PRESENTATION, completedAt: "2026-10-19T16:51:00Z" },
      }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "UNEXPECTED" } }) });
  });
  await page.route("**/api/workforce/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { name: "Local E2E" } }) }));
  await page.goto("/pinoria/tv-operator", { waitUntil: "domcontentloaded", timeout: 90000 });
  const input = page.getByRole("textbox", { name: "Center ID" });
  await expect.poll(async () => input.evaluate((el) => Object.keys(el).some((key) => key.startsWith("__reactProps$"))), { timeout: 60000 }).toBe(true);
  await input.fill(CENTER);
  await expect(page.getByRole("button", { name: "Làm mới" })).toBeEnabled({ timeout: 20000 });
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.getByText(PRESENTATION)).toBeVisible();
  await page.getByRole("button", { name: "Đóng presentation" }).click();
  await expect(page.getByRole("status")).toContainText("Core đã ghi receipt");
  await expect(page.getByText("Không có presentation đang chạy.")).toBeVisible();
  expect(captured).toHaveLength(1);
  expect(captured[0].body).toEqual({ centerId: CENTER, presentationId: PRESENTATION, expectedClaimedAt: CLAIM });
  expect(captured[0].idempotency).toMatch(/^[0-9a-f-]{36}$/i);
});

test("PAP-665 Return-to-Ambient respects Core receipt and queue release", async ({ page }) => {
  let released = false;
  let returnCalls = 0;
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/workforce/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/tos-learning/pinoria/presentations/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").pop();
    if (action === "queue") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      data: { current: released ? null : { id: PRESENTATION, kind: "EGG_HATCH", claimedAt: CLAIM, projection: {} },
        queued: [], revision: released ? 2 : 1, hasMore: false },
    }) });
    if (action === "return-to-ambient") {
      returnCalls++;
      expect(route.request().headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/i);
      expect(route.request().postDataJSON()).toEqual({ centerId: CENTER, presentationId: PRESENTATION, expectedClaimedAt: CLAIM });
      released = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        data: { presentationId: PRESENTATION, completedAt: "2026-10-19T17:09:00Z" },
      }) });
    }
    return route.fulfill({ status: 404, body: "unexpected operation" });
  });
  await page.goto("/pinoria/tv-operator", { waitUntil: "domcontentloaded", timeout: 90000 });
  const input = page.getByRole("textbox", { name: "Center ID" });
  await expect.poll(() => input.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))), { timeout: 60000 }).toBe(true);
  await input.fill(CENTER);
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.getByText(PRESENTATION)).toBeVisible();
  await page.getByRole("button", { name: "Trở về Ambient" }).click();
  await expect(page.getByRole("status")).toContainText("Core đã ghi receipt");
  await expect(page.getByText("Không có presentation đang chạy.")).toBeVisible();
  expect(returnCalls).toBe(1);
});

test("PAP-665 403 control denial keeps action fail-closed and requires new queue read", async ({ page }) => {
  let closeCalls = 0;
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/workforce/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/tos-learning/pinoria/presentations/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").pop();
    if (action === "queue") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      data: { current: { id: PRESENTATION, kind: "EGG_HATCH", claimedAt: CLAIM, projection: {} },
        queued: [], revision: 1, hasMore: false },
    }) });
    if (action === "close") {
      closeCalls++;
      return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({
        error: { code: "FORBIDDEN", message: "Permission denied" },
      }) });
    }
    return route.fulfill({ status: 404, body: "unexpected operation" });
  });
  await page.goto("/pinoria/tv-operator", { waitUntil: "domcontentloaded", timeout: 90000 });
  const input = page.getByRole("textbox", { name: "Center ID" });
  await expect.poll(() => input.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))), { timeout: 60000 }).toBe(true);
  await input.fill(CENTER);
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.getByText(PRESENTATION)).toBeVisible();
  await page.getByRole("button", { name: "Đóng presentation" }).click();
  await expect(page.getByText("Permission denied", { exact: true })).toBeVisible();
  await expect(page.getByText(PRESENTATION)).toHaveCount(0);
  expect(closeCalls).toBe(1);
});