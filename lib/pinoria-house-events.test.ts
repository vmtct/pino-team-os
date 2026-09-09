import assert from "node:assert/strict";
import test from "node:test";
import { advanceHouseSnapshotCursor, houseDepartureMatchesVisit, houseRefreshSnapshotIsCurrent, selectUnseenHouseEvents } from "../app/pinoria-tv/house-event-sequence";

type Event = { sequence: number; type: "ARRIVAL" | "DEPARTURE"; learner: string };

const arrival: Event = { sequence: 11, type: "ARRIVAL", learner: "a" };
const departure: Event = { sequence: 12, type: "DEPARTURE", learner: "a" };

test("duplicate arrival delivery produces one presentation event", () => {
  const result = selectUnseenHouseEvents([arrival, arrival], 10);
  assert.deepEqual(result.events, [arrival]);
  assert.equal(result.lastSequence, 11);
});

test("duplicate departure delivery produces one presentation event", () => {
  const result = selectUnseenHouseEvents([departure, departure], 11);
  assert.deepEqual(result.events, [departure]);
  assert.equal(result.lastSequence, 12);
});

test("snapshot cursor suppresses historical arrival and departure replay", () => {
  const historical: Event[] = [
    { sequence: 8, type: "ARRIVAL", learner: "old" },
    { sequence: 9, type: "DEPARTURE", learner: "old" },
    { sequence: 10, type: "ARRIVAL", learner: "present" },
  ];
  const result = selectUnseenHouseEvents(historical, 10);
  assert.deepEqual(result.events, []);
  assert.equal(result.lastSequence, 10);
});

test("new events are ordered by canonical sequence", () => {
  const result = selectUnseenHouseEvents([departure, arrival], 10);
  assert.deepEqual(result.events.map((event) => event.sequence), [11, 12]);
});

test("invalid sequence fails closed", () => {
  assert.throws(() => selectUnseenHouseEvents([{ ...arrival, sequence: 0 }], 0), /INVALID_HOUSE_EVENT_SEQUENCE/);
});

test("periodic refresh snapshot never consumes unseen ordered events", () => {
  assert.equal(houseRefreshSnapshotIsCurrent(12, 10, 10), true);
  const unseen = selectUnseenHouseEvents([arrival, departure], 10, 12);
  assert.equal(unseen.hasGap, false);
  assert.deepEqual(unseen.events.map((event) => event.sequence), [11, 12]);
  assert.equal(houseRefreshSnapshotIsCurrent(9, 10, 10), false);
});

test("out-of-order reconnect snapshot cannot regress cursor or replay history", () => {
  const newer = advanceHouseSnapshotCursor(15, 12, 12);
  assert.deepEqual(newer, { applySnapshot: true, cursor: 15, presentedSequence: 15 });
  const stale = advanceHouseSnapshotCursor(10, newer.cursor, newer.presentedSequence);
  assert.deepEqual(stale, { applySnapshot: false, cursor: 15, presentedSequence: 15 });
  const replay = selectUnseenHouseEvents([
    { sequence: 11, type: "ARRIVAL", learner: "old" },
    { sequence: 12, type: "DEPARTURE", learner: "old" },
    { sequence: 15, type: "ARRIVAL", learner: "present" },
  ], stale.presentedSequence);
  assert.deepEqual(replay.events, []);
});


test("stale departure transition cannot target a newer visit", () => {
  assert.equal(houseDepartureMatchesVisit("learner-a", "visit-a", "learner-a", "visit-a"), true);
  assert.equal(houseDepartureMatchesVisit("learner-a", "visit-b", "learner-a", "visit-a"), false);
  assert.equal(houseDepartureMatchesVisit("learner-b", "visit-a", "learner-a", "visit-a"), false);
});

test("event page sequence gap fails closed before cursor advance", () => {
  const result = selectUnseenHouseEvents([
    { sequence: 11, type: "ARRIVAL", learner: "a" },
    { sequence: 13, type: "DEPARTURE", learner: "a" },
  ], 10, 13);
  assert.equal(result.hasGap, true);
  assert.deepEqual(result.events.map((event) => event.sequence), [11, 13]);
});

test("event page cursor cannot skip payload sequences", () => {
  const result = selectUnseenHouseEvents([], 10, 12);
  assert.equal(result.hasGap, true);
  assert.equal(result.lastSequence, 10);
});

test("contiguous event page remains eligible for presentation", () => {
  const result = selectUnseenHouseEvents([arrival, departure], 10, 12);
  assert.equal(result.hasGap, false);
  assert.equal(result.lastSequence, 12);
});
