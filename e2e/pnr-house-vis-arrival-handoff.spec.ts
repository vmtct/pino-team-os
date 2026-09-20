import { expect, test, type Page } from "@playwright/test";

const character = {
  hair: "https://assets.pinohouse.art/draft/Char_hair_girl_short.png",
  face: "https://assets.pinohouse.art/draft/Char_face_smiley.png",
  outfit: "https://assets.pinohouse.art/draft/Char_body_painting_girl.png",
};

type ActorType = "LEARNER" | "STAFF";
type SourceType = "STUDENT_VISIT" | "TIMEKEEPING_SESSION";
const sourceType = (actorType: ActorType): SourceType => actorType === "LEARNER" ? "STUDENT_VISIT" : "TIMEKEEPING_SESSION";

function actor(selfId: string, actorType: ActorType, sourceId: string, name: string, sources?: Array<{ actorType: ActorType; sourceType: SourceType; sourceId: string; openedAt: string }>, config: typeof character | null = character) {
  return {
    pinoriaSelfId: selfId,
    actorType,
    displayName: name,
    characterId: config ? `character-${selfId}` : null,
    character: config,
    loadout: config ? { version: 1, slots: {} } : null,
    sources: sources ?? [{ actorType, sourceType: sourceType(actorType), sourceId, openedAt: "2026-09-07T04:00:00.000Z" }],
  };
}

function presenceEvent(sequence: number, type: "ARRIVAL" | "DEPARTURE", selfId: string, actorType: ActorType, sourceId: string, name: string, config: typeof character | null = character) {
  return {
    sequence,
    kind: "PRESENCE_EVENT",
    id: `event-${sequence}`,
    type,
    actorType,
    sourceType: sourceType(actorType),
    sourceId,
    pinoriaSelfId: selfId,
    occurredAt: `2026-09-07T04:00:${String(sequence).padStart(2, "0")}.000Z`,
    payload: { displayName: name, characterId: config ? `character-${selfId}` : null, character: config, loadout: config ? { version: 1, slots: {} } : null },
  };
}

async function noPresentations(page: Page) {
  await page.route("**/api/pinoria-tv/presentation", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ presentation: null }),
  }));
}

test("learner and Staff arrivals hand off sequentially into Self-keyed ambient actors", async ({ page }) => {
  let delivered = false;
  await page.route("**/api/pinoria-tv/snapshot**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 0, actors: [] } }) }));
  await page.route("**/api/pinoria-tv/events**", (route) => {
    const events = delivered ? [] : [
      presenceEvent(1, "ARRIVAL", "self-learner", "LEARNER", "visit-learner", "Bơ"),
      presenceEvent(2, "ARRIVAL", "self-staff", "STAFF", "timekeeping-staff", "Mai"),
    ];
    delivered = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 2, events } }) });
  });
  await noPresentations(page);

  await page.goto("/pinoria-tv?centerId=unified-arrivals");
  const scene = page.locator('[data-arrival-scene="true"]');
  const learner = page.locator('[data-ambient-runtime-self="self-learner"]');
  const staff = page.locator('[data-ambient-runtime-self="self-staff"]');
  await expect(scene.getByRole("heading", { level: 1 })).toHaveText("Chào Bơ ✦", { timeout: 5_000 });
  await expect(scene).toHaveAttribute("data-presence-actor-type", "LEARNER");
  await expect(learner).toHaveAttribute("data-suppressed", "true");
  await expect(staff).toHaveAttribute("data-ambient-runtime-actor-type", "STAFF");
  await expect(scene).toHaveAttribute("data-arrival-phase", "handoff", { timeout: 7_000 });
  await expect(scene.getByRole("heading", { level: 1 })).toHaveText("Chào Mai ✦", { timeout: 5_000 });
  await expect(scene).toHaveAttribute("data-presence-actor-type", "STAFF");
  await expect(scene).toHaveAttribute("data-arrival-source-type", "TIMEKEEPING_SESSION");
});

test("reconnect snapshot cancels a stale Staff arrival and never replays it", async ({ page }) => {
  let snapshotCalls = 0;
  let eventCalls = 0;
  await page.route("**/api/pinoria-tv/snapshot**", (route) => {
    snapshotCalls += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: snapshotCalls === 1 ? 0 : 2, actors: [] } }) });
  });
  await page.route("**/api/pinoria-tv/events**", (route) => {
    eventCalls += 1;
    if (eventCalls === 1) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 1, events: [presenceEvent(1, "ARRIVAL", "self-stale-staff", "STAFF", "timekeeping-stale", "Gone")] } }) });
    return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  });
  await noPresentations(page);

  await page.goto("/pinoria-tv?centerId=staff-reconnect");
  const scene = page.locator('[data-arrival-scene="true"]');
  await expect(scene).toHaveAttribute("data-presence-actor-type", "STAFF", { timeout: 5_000 });
  await expect.poll(() => snapshotCalls, { timeout: 6_000 }).toBeGreaterThan(1);
  await expect(scene).toHaveCount(0);
  await expect(page.locator('[data-ambient-runtime-self="self-stale-staff"]')).toHaveCount(0);
});

test("replacement source on the same Self drops stale arrival and departure scenes", async ({ page }) => {
  let delivered = false;
  await page.route("**/api/pinoria-tv/snapshot**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 0, actors: [] } }) }));
  await page.route("**/api/pinoria-tv/events**", (route) => {
    const events = delivered ? [] : [
      presenceEvent(1, "ARRIVAL", "self-reused", "LEARNER", "visit-old", "Old source"),
      presenceEvent(2, "DEPARTURE", "self-reused", "LEARNER", "visit-old", "Old source"),
      presenceEvent(3, "ARRIVAL", "self-reused", "LEARNER", "visit-new", "New source"),
    ];
    delivered = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 3, events } }) });
  });
  await noPresentations(page);

  await page.goto("/pinoria-tv?centerId=replacement-source");
  const scene = page.locator('[data-arrival-scene="true"]');
  const ambient = page.locator('[data-ambient-runtime-self="self-reused"]');
  await expect(scene.getByRole("heading", { level: 1 })).toHaveText("Chào New source ✦", { timeout: 5_000 });
  await expect(scene).toHaveAttribute("data-arrival-source-id", "visit-new");
  await expect(ambient).toHaveCount(1);
  await expect(ambient).toHaveAttribute("data-suppressed", "true");
});

test("dual learner plus Staff source reconciles to one ambient Self without a second hero", async ({ page }) => {
  let snapshotCalls = 0;
  let reconcileDelivered = false;
  const learnerSource = { actorType: "LEARNER" as const, sourceType: "STUDENT_VISIT" as const, sourceId: "visit-dual", openedAt: "2026-09-07T04:00:00.000Z" };
  const staffSource = { actorType: "STAFF" as const, sourceType: "TIMEKEEPING_SESSION" as const, sourceId: "timekeeping-dual", openedAt: "2026-09-07T04:10:00.000Z" };
  await page.route("**/api/pinoria-tv/snapshot**", (route) => {
    snapshotCalls += 1;
    const sources = snapshotCalls === 1 ? [learnerSource] : [learnerSource, staffSource];
    const actorType: ActorType = snapshotCalls === 1 ? "LEARNER" : "STAFF";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: snapshotCalls === 1 ? 0 : 1, actors: [actor("self-dual", actorType, sources[0]!.sourceId, "Dual", sources)] } }) });
  });
  await page.route("**/api/pinoria-tv/events**", (route) => {
    const events = reconcileDelivered ? [] : [{ sequence: 1, kind: "RECONCILE_REQUIRED", pinoriaSelfId: "self-dual", sourceType: "TIMEKEEPING_SESSION", sourceId: "timekeeping-dual", occurredAt: "2026-09-07T04:10:00.000Z" }];
    reconcileDelivered = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 1, events } }) });
  });
  await noPresentations(page);

  await page.goto("/pinoria-tv?centerId=dual-source");
  const ambient = page.locator('[data-ambient-runtime-self="self-dual"]');
  await expect(ambient).toHaveCount(1);
  await expect.poll(() => snapshotCalls, { timeout: 6_000 }).toBeGreaterThan(1);
  await expect(ambient).toHaveCount(1);
  await expect(ambient).toHaveAttribute("data-ambient-runtime-actor-type", "STAFF");
  await expect(page.locator('[data-arrival-scene="true"]')).toHaveCount(0);
});

test("mixed 30 learner plus 10 Staff snapshot renders 40 unique Self actors", async ({ page }) => {
  const actors = Array.from({ length: 40 }, (_, index) => {
    const actorType: ActorType = index < 30 ? "LEARNER" : "STAFF";
    return actor(`self-${index}`, actorType, `${actorType === "LEARNER" ? "visit" : "timekeeping"}-${index}`, `${actorType} ${index}`, undefined, index === 39 ? null : character);
  });
  await page.route("**/api/pinoria-tv/snapshot**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 40, actors } }) }));
  await page.route("**/api/pinoria-tv/events**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 40, events: [] } }) }));
  await noPresentations(page);

  await page.goto("/pinoria-tv?centerId=mixed-40");
  const ambient = page.locator("[data-ambient-runtime-self]");
  await expect(ambient).toHaveCount(40, { timeout: 7_000 });
  await expect(page.locator('[data-ambient-runtime-actor-type="STAFF"]')).toHaveCount(10);
  await expect(page.locator('[data-ambient-runtime-self="self-39"] [data-character-state="invalid"]')).toHaveCount(1);
});

test("reduced motion lands Staff arrival hero on its reserved Self actor", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let delivered = false;
  await page.route("**/api/pinoria-tv/snapshot**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 0, actors: [] } }) }));
  await page.route("**/api/pinoria-tv/events**", (route) => {
    const events = delivered ? [] : [presenceEvent(1, "ARRIVAL", "self-reduced", "STAFF", "timekeeping-reduced", "Reduced")];
    delivered = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { cursor: 1, events } }) });
  });
  await noPresentations(page);

  await page.goto("/pinoria-tv?centerId=reduced-staff");
  const scene = page.locator('[data-arrival-scene="true"]');
  const ambient = page.locator('[data-ambient-runtime-self="self-reduced"]');
  await expect(scene).toHaveAttribute("data-arrival-phase", "handoff", { timeout: 7_000 });
  await expect(ambient).toHaveAttribute("data-suppressed", "true");
  await expect.poll(() => scene.evaluate((element) => (element as HTMLElement).style.getPropertyValue("--arrival-target-left"))).not.toBe("");
  const delta = await scene.evaluate((element) => {
    const hero = Array.from(element.children).find((child) => child.querySelectorAll("img").length >= 3) as HTMLElement;
    const target = document.querySelector('[data-ambient-runtime-self="self-reduced"]') as HTMLElement;
    const h = hero.getBoundingClientRect(); const t = target.getBoundingClientRect();
    return Math.max(Math.abs(h.x - t.x), Math.abs(h.y - t.y), Math.abs(h.width - t.width), Math.abs(h.height - t.height));
  });
  expect(delta).toBeLessThan(1);
});
