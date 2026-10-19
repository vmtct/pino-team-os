import { test, expect } from "@playwright/test";
const DISPLAY = "33333333-3333-4333-8333-333333333333";
const CENTER = "11111111-1111-4111-8111-111111111111";
const PRESENTATION = "22222222-2222-4222-8222-222222222222";
test("PAP-665 TV session preserves scene on status outage and releases after Core closure", async ({ page }) => {
  let active = true;
  let statusUnavailable = false;
  let claimCalls = 0;
  let completionCalls = 0;
  const projection = {
    schemaVersion: 1, presentationId: PRESENTATION, centerId: CENTER,
    visitId: "44444444-4444-4444-8444-444444444444",
    subject: { studentProfileId: "55555555-5555-4555-8555-555555555555",
      displayName: "Test Piner",
      character: { id: "66666666-6666-4666-8666-666666666666", config: {} } },
    egg: { id: "77777777-7777-4777-8777-777777777777", assetKey: "" },
    companion: {
      id: "88888888-8888-4888-8888-888888888888",
      speciesId: "99999999-9999-4999-8999-999999999999",
      key: "mori", displayName: "MORI", assetKey: "", sigilAssetKey: null,
    },
    experience: { profileKey: "local-tv-e2e" },
  };
  await page.route("**/api/tv/runtime/**", async (route) => {
    const url = new URL(route.request().url());
    const suffix = url.pathname.split("/").pop();
    const respond = (value: unknown, status = 200) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(value),
    });
    if (suffix === "context") return respond({ data: {
      sessionId: "session-local", expiresAt: "2026-10-20T00:00:00Z",
      display: { id: DISPLAY, key: "reception-pinoria", displayName: "Reception TV",
        runtimeType: "PINORIA_HOUSE", scopeType: "CENTER", scopeId: CENTER,
        orientation: "LANDSCAPE", targetAspectRatio: "16:9" },
    } });
    if (suffix === "snapshot") return respond({ data: { cursor: 0, actors: [] } });
    if (suffix === "events") return respond({ data: { cursor: 0, events: [] } });
    if (suffix === "onboarding-preview") return respond({ data: null });
    if (suffix === "presentation") {
      const body = route.request().postDataJSON() as { op: string };
      if (body.op === "claim") {
        claimCalls++;
        return respond({ presentation: active && claimCalls === 1
          ? { id: PRESENTATION, kind: "EGG_HATCH", claimedAt: "2026-10-19T10:59:00Z", projection }
          : null });
      }
      if (body.op === "status") {
        if (statusUnavailable) return respond({ error: "Unavailable" }, 503);
        return respond({ ok: true, activePresentationId: active ? PRESENTATION : null });
      }
      if (body.op === "complete") {
        completionCalls++;
        return respond({ ok: true, presentationId: PRESENTATION, completedAt: "2026-10-19T11:00:00Z" });
      }
      return respond({ error: "unsupported" }, 400);
    }
    return respond({ error: "unexpected" }, 404);
  });
  await page.goto("/tv/" + DISPLAY, { waitUntil: "domcontentloaded", timeout: 90000 });
  const scene = page.getByRole("region", { name: "MORI hatched" });
  await expect(scene).toBeVisible({ timeout: 45000 });
  statusUnavailable = true;
  await page.waitForTimeout(2200);
  await expect(scene).toBeVisible();
  active = false;
  statusUnavailable = false;
  await expect(scene).toHaveCount(0, { timeout: 6000 });
  expect(completionCalls).toBe(0);
  expect(claimCalls).toBeGreaterThanOrEqual(1);
});

test("PAP-665 revoked display session unmounts renderer, transient context outage does not", async ({ page }) => {
  let contextStatus = 200;
  let contextReads = 0;
  await page.route("**/api/tv/runtime/**", async (route) => {
    const suffix = new URL(route.request().url()).pathname.split("/").pop();
    const respond = (value: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (suffix === "context") {
      contextReads++;
      if (contextStatus !== 200) return respond({ error: { message: "Denied" } }, contextStatus);
      return respond({ data: {
        sessionId: "local-valid", expiresAt: "2026-10-20T00:00:00Z",
        display: { id: DISPLAY, key: "reception-pinoria", displayName: "Reception TV",
          runtimeType: "PINORIA_HOUSE", scopeType: "CENTER", scopeId: CENTER,
          orientation: "LANDSCAPE", targetAspectRatio: "16:9" },
      } });
    }
    if (suffix === "snapshot") return respond({ data: { cursor: 0, actors: [] } });
    if (suffix === "events") return respond({ data: { cursor: 0, events: [] } });
    if (suffix === "onboarding-preview") return respond({ data: null });
    if (suffix === "presentation") return respond({ presentation: null, ok: true, activePresentationId: null });
    return respond({ error: "unexpected" }, 404);
  });
  await page.goto("/tv/" + DISPLAY, { waitUntil: "domcontentloaded", timeout: 90000 });
  const activeRuntime = page.locator('[data-tv-runtime-active="PINORIA_HOUSE"]');
  await expect(activeRuntime).toBeVisible({ timeout: 45000 });
  const initialReads = contextReads;
  contextStatus = 503;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => contextReads).toBeGreaterThan(initialReads);
  await expect(activeRuntime).toBeVisible();
  contextStatus = 403;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByText("TV runtime session expired or revoked")).toBeVisible({ timeout: 10000 });
  await expect(activeRuntime).toHaveCount(0);
});
