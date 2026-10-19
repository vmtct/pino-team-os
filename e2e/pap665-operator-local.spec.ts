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
test("PAP-665 409 stale claim forces authoritative reload without false success", async ({ page }) => {
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
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({
        error: { code: "PRESENTATION_CLAIM_CONFLICT", message: "Presentation changed; reload queue" },
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
  await expect(page.getByText("Presentation changed; reload queue", { exact: true })).toBeVisible();
  await expect(page.getByText(PRESENTATION)).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(closeCalls).toBe(1);
});
test("PAP-665 Center switch during pending Close never applies stale receipt to new Center", async ({ page }) => {
  const otherCenter = "33333333-3333-4333-8333-333333333333";
  let releaseClose!: () => void;
  const closeGate = new Promise<void>((resolve) => { releaseClose = resolve; });
  let closeCalls = 0;
  let queueForOldCenterAfterClose = 0;
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/workforce/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/tos-learning/pinoria/presentations/**", async (route) => {
    const request = route.request();
    const action = new URL(request.url()).pathname.split("/").pop();
    if (action === "queue") {
      const center = new URL(request.url()).searchParams.get("centerId");
      if (center === CENTER && closeCalls > 0) queueForOldCenterAfterClose++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        data: { current: center === CENTER ? { id: PRESENTATION, kind: "EGG_HATCH", claimedAt: CLAIM, projection: {} } : null,
          queued: [], revision: 1, hasMore: false },
      }) });
    }
    if (action === "close") {
      closeCalls++;
      await closeGate;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        data: { presentationId: PRESENTATION, completedAt: "2026-10-19T17:17:00Z" },
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
  await expect.poll(() => closeCalls).toBe(1);
  await input.fill(otherCenter);
  releaseClose();
  await expect(page.getByText(PRESENTATION)).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Làm mới" })).toBeEnabled();
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.getByText("Không có presentation đang chạy.")).toBeVisible();
  expect(queueForOldCenterAfterClose).toBe(0);
});
test("PAP-665 physical replay checks target and sends idempotent Core dispatch", async ({ page }) => {
  const displayId = "33333333-3333-4333-8333-333333333333";
  let targetChecks = 0;
  const dispatches: Array<{ body: unknown; key: string | undefined }> = [];
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/workforce/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/tos-learning/pinoria/presentations/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.pathname.split("/").pop();
    if (action === "queue") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      current: { id: PRESENTATION, kind: "EGG_HATCH", claimedAt: CLAIM, projection: {} }, queued: [], revision: 1, hasMore: false,
    } }) });
    if (action === "replay-target") {
      targetChecks++;
      expect(url.searchParams.get("centerId")).toBe(CENTER);
      expect(url.searchParams.get("displayId")).toBe(displayId);
      expect(url.searchParams.get("presentationId")).toBe(PRESENTATION);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
        available: true, target: { displayId, deviceId: "44444444-4444-4444-8444-444444444444" },
      } }) });
    }
    if (action === "replay-dispatch") {
      dispatches.push({ body: request.postDataJSON(), key: request.headers()["idempotency-key"] });
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { accepted: true } }) });
    }
    return route.fulfill({ status: 404, body: "unexpected operation" });
  });
  await page.goto("/pinoria/tv-operator", { waitUntil: "domcontentloaded", timeout: 90000 });
  const input = page.getByRole("textbox", { name: "Center ID" });
  await expect.poll(() => input.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))), { timeout: 60000 }).toBe(true);
  await input.fill(CENTER);
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.getByText(PRESENTATION)).toBeVisible();
  await page.getByRole("textbox", { name: "Display ID để replay" }).fill(displayId);
  await page.getByRole("button", { name: "Phát lại trên TV" }).click();
  await expect(page.getByRole("status")).toContainText("chưa có xác nhận TV vật lý đã render");
  expect(targetChecks).toBe(1);
  expect(dispatches).toHaveLength(1);
  expect(dispatches[0].body).toEqual({ centerId: CENTER, displayId, presentationId: PRESENTATION });
  expect(dispatches[0].key).toMatch(/^[0-9a-f-]{36}$/i);
});

test("PAP-665 physical replay fails closed when target lacks a device session", async ({ page }) => {
  const displayId = "33333333-3333-4333-8333-333333333333";
  let dispatches = 0;
  await page.route("**/api/workforce/profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/tos-learning/pinoria/presentations/**", async (route) => {
    const action = new URL(route.request().url()).pathname.split("/").pop();
    if (action === "queue") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
      current: { id: PRESENTATION, kind: "EGG_HATCH", claimedAt: CLAIM, projection: {} }, queued: [], revision: 1, hasMore: false,
    } }) });
    if (action === "replay-target") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      data: { available: true, target: { displayId } },
    }) });
    if (action === "replay-dispatch") dispatches++;
    return route.fulfill({ status: 404, body: "unexpected operation" });
  });
  await page.goto("/pinoria/tv-operator", { waitUntil: "domcontentloaded", timeout: 90000 });
  const input = page.getByRole("textbox", { name: "Center ID" });
  await expect.poll(() => input.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))), { timeout: 60000 }).toBe(true);
  await input.fill(CENTER);
  await page.getByRole("button", { name: "Làm mới" }).click();
  await expect(page.getByText(PRESENTATION)).toBeVisible();
  await page.getByRole("textbox", { name: "Display ID để replay" }).fill(displayId);
  await page.getByRole("button", { name: "Phát lại trên TV" }).click();
  await expect(page.getByText("TV đích chưa có phiên hoạt động hợp lệ; không gửi replay.")).toBeVisible();
  expect(dispatches).toBe(0);
});
