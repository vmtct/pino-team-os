import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectUnseenHouseEvents } from "../app/pinoria-tv/house-event-sequence";
import {
  actorFromArrival,
  actorHasSource,
  parsePresenceEventPage,
  parsePresenceSnapshot,
} from "../app/pinoria-tv/presence-contract";

const character = { hair: "hair.png", face: "face.png", outfit: "outfit.png" };

function actor(index: number, actorType: "LEARNER" | "STAFF" = "LEARNER") {
  const sourceType = actorType === "LEARNER" ? "STUDENT_VISIT" : "TIMEKEEPING_SESSION";
  return {
    pinoriaSelfId: `self-${index}`,
    actorType,
    displayName: `${actorType === "STAFF" ? "Staff" : "Learner"} ${index}`,
    characterId: actorType === "STAFF" && index === 39 ? null : `character-${index}`,
    character: actorType === "STAFF" && index === 39 ? null : character,
    loadout: actorType === "STAFF" && index === 39 ? null : { version: 2, slots: { OUTFIT: `variant-${index}` } },
    sources: [{ actorType, sourceType, sourceId: `source-${index}`, openedAt: "2026-09-07T04:00:00.000Z" }],
  };
}

test("mixed 30 learner + 10 Staff snapshot preserves one actor per Pinoria Self", () => {
  const actors = Array.from({ length: 40 }, (_, index) => actor(index, index < 30 ? "LEARNER" : "STAFF"));
  const snapshot = parsePresenceSnapshot({ cursor: 42, actors });
  assert.equal(snapshot.actors.length, 40);
  assert.equal(new Set(snapshot.actors.map((item) => item.pinoriaSelfId)).size, 40);
  assert.equal(snapshot.actors.filter((item) => item.actorType === "STAFF").length, 10);
  assert.equal(snapshot.actors.at(-1)?.character, null);
});

test("snapshot rejects duplicate Pinoria Self instead of rendering duplicate ambient actors", () => {
  const same = actor(1);
  assert.throws(() => parsePresenceSnapshot({ cursor: 1, actors: [same, same] }), /PINORIA_PRESENCE_DUPLICATE_SELF/);
});

test("dual learner + Staff sources remain one Self and exact source matching stays explicit", () => {
  const row = actor(2);
  row.sources.push({ actorType: "STAFF", sourceType: "TIMEKEEPING_SESSION", sourceId: "timekeeping-2", openedAt: "2026-09-07T04:10:00.000Z" });
  const parsed = parsePresenceSnapshot({ cursor: 2, actors: [row] }).actors[0]!;
  assert.equal(actorHasSource(parsed, "STUDENT_VISIT", "source-2"), true);
  assert.equal(actorHasSource(parsed, "TIMEKEEPING_SESSION", "timekeeping-2"), true);
  assert.equal(actorHasSource(parsed, "TIMEKEEPING_SESSION", "other"), false);
});

test("Staff-only arrival accepts no character and preserves Timekeeping source lineage", () => {
  const page = parsePresenceEventPage({ cursor: 1, events: [{
    sequence: 1,
    kind: "PRESENCE_EVENT",
    id: "event-1",
    type: "ARRIVAL",
    actorType: "STAFF",
    sourceType: "TIMEKEEPING_SESSION",
    sourceId: "timekeeping-1",
    pinoriaSelfId: "self-staff",
    occurredAt: "2026-09-07T04:00:00.000Z",
    payload: { displayName: "Mai", characterId: null, character: null, loadout: null },
  }] });
  const event = page.events[0]!;
  assert.equal(event.kind, "PRESENCE_EVENT");
  if (event.kind !== "PRESENCE_EVENT") throw new Error("expected presence event");
  const projected = actorFromArrival(event);
  assert.equal(projected.actorType, "STAFF");
  assert.equal(projected.character, null);
  assert.equal(actorHasSource(projected, "TIMEKEEPING_SESSION", "timekeeping-1"), true);
});

test("learner event remains compatible when historical payload omits characterId and loadout", () => {
  const page = parsePresenceEventPage({ cursor: 7, events: [{
    sequence: 7,
    kind: "PRESENCE_EVENT",
    id: "event-7",
    type: "ARRIVAL",
    actorType: "LEARNER",
    sourceType: "STUDENT_VISIT",
    sourceId: "visit-7",
    pinoriaSelfId: "self-7",
    occurredAt: "2026-09-07T04:00:00.000Z",
    payload: { displayName: "Bơ", character },
  }] });
  const event = page.events[0];
  assert.equal(event?.kind, "PRESENCE_EVENT");
  if (!event || event.kind !== "PRESENCE_EVENT") throw new Error("expected presence event");
  assert.equal(event.payload.characterId, null);
  assert.equal(event.payload.loadout, null);
});

test("reconcile marker consumes canonical sequence without becoming a hero event", () => {
  const page = parsePresenceEventPage({ cursor: 12, events: [{
    sequence: 12,
    kind: "RECONCILE_REQUIRED",
    pinoriaSelfId: "self-12",
    sourceType: "TIMEKEEPING_SESSION",
    sourceId: "timekeeping-12",
    occurredAt: "2026-09-07T04:00:00.000Z",
  }] });
  const selected = selectUnseenHouseEvents(page.events, 11, page.cursor);
  assert.equal(selected.hasGap, false);
  assert.equal(selected.events.length, 1);
  assert.equal(selected.events[0]?.kind, "RECONCILE_REQUIRED");
  assert.equal(selected.events.filter((event) => event.kind === "PRESENCE_EVENT").length, 0);
});

test("Pinoria TV routes consume unified presence only and never Workforce directly", () => {
  const snapshot = readFileSync("app/api/pinoria-tv/snapshot/route.ts", "utf8");
  const events = readFileSync("app/api/pinoria-tv/events/route.ts", "utf8");
  const binding = readFileSync("lib/staff-pin-core.ts", "utf8");
  assert.match(snapshot, /PINO_PINORIA_TV_CORE\.presenceSnapshot\(centerId\)/);
  assert.match(events, /PINO_PINORIA_TV_CORE\.presenceEvents\(centerId, after, 100\)/);
  assert.match(binding, /presenceSnapshot/);
  assert.match(binding, /presenceEvents/);
  assert.doesNotMatch(`${snapshot}\n${events}`, /PINO_WORKFORCE_CORE|workforce_timekeeping|TimekeepingSession/);
});

test("source lineage rejects actor/source spoofing and duplicates", () => {
  const base = actor(5);
  assert.throws(() => parsePresenceSnapshot({ cursor: 1, actors: [{ ...base, sources: [{ actorType: "STAFF", sourceType: "STUDENT_VISIT", sourceId: "bad", openedAt: "2026-09-07T04:00:00.000Z" }] }] }), /PINORIA_PRESENCE_SOURCE_ACTOR_MISMATCH/);
  assert.throws(() => parsePresenceSnapshot({ cursor: 1, actors: [{ ...base, sources: [base.sources[0], base.sources[0]] }] }), /PINORIA_PRESENCE_DUPLICATE_SOURCE/);
});
