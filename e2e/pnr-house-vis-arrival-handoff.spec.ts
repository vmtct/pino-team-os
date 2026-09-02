import { expect, test } from "@playwright/test";

const character = {
  hair: "draft/Hair01.png",
  face: "draft/Face01.png",
  outfit: "draft/Outfit01.png",
};

test("arrival heroes hand off sequentially into reserved ambient actors", async ({ page }) => {
  let delivered = false;
  await page.route("**/api/pinoria-tv/snapshot**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 0, learners: [] } }) });
  });
  await page.route("**/api/pinoria-tv/events**", async (route) => {
    const after = Number(new URL(route.request().url()).searchParams.get("after") ?? "0");
    const events = !delivered && after === 0 ? [{
      sequence: 1,
      type: "ARRIVAL",
      studentProfileId: "learner-arrival",
      visitId: "visit-arrival",
      characterId: "character-arrival",
      occurredAt: "2026-09-02T00:00:00.000Z",
      payload: { displayName: "Bơ", character },
    }, {
      sequence: 2,
      type: "ARRIVAL",
      studentProfileId: "learner-queued",
      visitId: "visit-queued",
      characterId: "character-queued",
      occurredAt: "2026-09-02T00:00:01.000Z",
      payload: { displayName: "Chây", character },
    }] : [];
    if (events.length) delivered = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: delivered ? 2 : 0, events } }) });
  });
  await page.route("**/api/pinoria-tv/presentation", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ presentation: null }) });
  });

  await page.goto("/pinoria-tv?centerId=review");
  const scene = page.locator('[data-arrival-scene="true"]');
  const actor = page.locator('[data-ambient-runtime-character="learner-arrival"]');
  const queuedActor = page.locator('[data-ambient-runtime-character="learner-queued"]');
  await expect(scene).toHaveAttribute("data-arrival-phase", "performance", { timeout: 5_000 });
  await expect(actor).toHaveAttribute("data-suppressed", "true");
  await expect(queuedActor).toHaveAttribute("data-suppressed", "true");
  expect(await actor.boundingBox()).not.toBeNull();

  await expect(scene).toHaveAttribute("data-arrival-phase", "handoff", { timeout: 7_000 });
  await expect(actor).toHaveAttribute("data-suppressed", "true");
  await expect.poll(async () => scene.evaluate((element) => ({
    left: (element as HTMLElement).style.getPropertyValue("--arrival-target-left"),
    top: (element as HTMLElement).style.getPropertyValue("--arrival-target-top"),
    width: (element as HTMLElement).style.getPropertyValue("--arrival-target-width"),
  }))).not.toEqual({ left: "", top: "", width: "" });

  await expect(scene.getByRole("heading", { level: 1 })).toHaveText("Chây", { timeout: 4_000 });
  await expect(actor).toHaveAttribute("data-suppressed", "false");
  await expect(queuedActor).toHaveAttribute("data-suppressed", "true");
});

test("newer reconnect snapshot cancels a stale arrival before handoff", async ({ page }) => {
  let snapshotCalls = 0;
  let eventCalls = 0;
  await page.route("**/api/pinoria-tv/snapshot**", async (route) => {
    snapshotCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { cursor: snapshotCalls === 1 ? 0 : 2, learners: [] } }),
    });
  });
  await page.route("**/api/pinoria-tv/events**", async (route) => {
    eventCalls += 1;
    if (eventCalls === 1) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 1, events: [{
        sequence: 1,
        type: "ARRIVAL",
        studentProfileId: "learner-stale-arrival",
        visitId: "visit-stale-arrival",
        characterId: "character-stale-arrival",
        occurredAt: "2026-09-02T00:00:00.000Z",
        payload: { displayName: "Gone", character },
      }] } }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/pinoria-tv/presentation", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ presentation: null }) });
  });

  await page.goto("/pinoria-tv?centerId=review-reconnect");
  const scene = page.locator('[data-arrival-scene="true"]');
  const actor = page.locator('[data-ambient-runtime-character="learner-stale-arrival"]');
  await expect(scene).toHaveAttribute("data-arrival-phase", "performance", { timeout: 5_000 });
  await expect(actor).toHaveAttribute("data-suppressed", "true");
  await expect.poll(() => snapshotCalls, { timeout: 5_000 }).toBeGreaterThan(1);
  await expect(scene).toHaveCount(0, { timeout: 3_000 });
  await expect(actor).toHaveCount(0);
  await page.waitForTimeout(3_500);
  await expect(scene).toHaveCount(0);
});


test("same learner replacement visit never receives a stale arrival handoff", async ({ page }) => {
  let delivered = false;
  await page.route("**/api/pinoria-tv/snapshot**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 0, learners: [] } }) });
  });
  await page.route("**/api/pinoria-tv/events**", async (route) => {
    const events = delivered ? [] : [
      { sequence: 1, type: "ARRIVAL", studentProfileId: "same-learner", visitId: "visit-old", characterId: "character-old", occurredAt: "2026-09-02T00:00:01.000Z", payload: { displayName: "Old visit", character } },
      { sequence: 2, type: "DEPARTURE", studentProfileId: "same-learner", visitId: "visit-old", characterId: "character-old", occurredAt: "2026-09-02T00:00:02.000Z", payload: { displayName: "Old visit", character } },
      { sequence: 3, type: "ARRIVAL", studentProfileId: "same-learner", visitId: "visit-new", characterId: "character-new", occurredAt: "2026-09-02T00:00:03.000Z", payload: { displayName: "New visit", character } },
    ];
    delivered = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 3, events } }) });
  });
  await page.route("**/api/pinoria-tv/presentation", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ presentation: null }) });
  });

  await page.goto("/pinoria-tv?centerId=review-replacement-visit");
  const scene = page.locator('[data-arrival-scene="true"]');
  const actor = page.locator('[data-ambient-runtime-character="same-learner"]');
  await expect(scene.getByRole("heading", { level: 1 })).toHaveText("New visit", { timeout: 9_000 });
  await expect(scene).toHaveAttribute("data-arrival-visit", "visit-new");
  await expect(actor).toHaveAttribute("data-ambient-runtime-visit", "visit-new");
  await expect(actor).toHaveAttribute("data-suppressed", "true");  await expect(scene).toHaveAttribute("data-arrival-phase", "handoff", { timeout: 7_000 });
  await expect.poll(async () => scene.evaluate((element) => ({
    left: (element as HTMLElement).style.getPropertyValue("--arrival-target-left"),
    top: (element as HTMLElement).style.getPropertyValue("--arrival-target-top"),
    width: (element as HTMLElement).style.getPropertyValue("--arrival-target-width"),
  }))).not.toEqual({ left: "", top: "", width: "" });
  await expect(actor).toHaveAttribute("data-suppressed", "true");
});
