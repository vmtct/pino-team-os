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
