import assert from "node:assert/strict";
import test from "node:test";
import { selectUnseenHouseEvents } from "../app/pinoria-tv/house-event-sequence";

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
