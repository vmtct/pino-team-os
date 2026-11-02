import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptsTvReplayInstruction, acceptsTvReplayAck } from "./replay-command-guard";
const current = { centerId: "center-a", displayId: "display-a", sessionId: "session-a", revision: 4, activePresentationId: "11111111-1111-4111-8111-111111111111" };
const next = { ...current, revision: 5, presentationId: "11111111-1111-4111-8111-111111111111" };
test("only a newer authenticated-session-bound replay is eligible", () => {
  assert.equal(acceptsTvReplayInstruction(current, next), true);
  for (const bad of [
    { ...next, centerId: "center-b" }, { ...next, displayId: "display-b" },
    { ...next, sessionId: "session-b" }, { ...next, revision: 4 },
    { ...next, revision: 3 }, { ...next, revision: Number.NaN },
    { ...next, presentationId: "bad" },
  ]) assert.equal(acceptsTvReplayInstruction(current, bad), false);
});
test("malformed local runtime cursor cannot authorize replay", () => {
  for (const invalid of [{ ...current, sessionId: "" }, { ...current, revision: -1 }, { ...current, activePresentationId: null }, { ...current, activePresentationId: "22222222-2222-4222-8222-222222222222" }]) {
    assert.equal(acceptsTvReplayInstruction(invalid, next), false);
  }
});

test("replay ACK must match the exact session, active presentation and revision", () => {
  const ack = { centerId: next.centerId, displayId: next.displayId, sessionId: next.sessionId,
    presentationId: next.presentationId, revision: next.revision };
  assert.equal(acceptsTvReplayAck(next, ack), true);
  for (const bad of [
    { ...ack, centerId: "center-b" }, { ...ack, displayId: "display-b" },
    { ...ack, sessionId: "session-b" }, { ...ack, presentationId: "22222222-2222-4222-8222-222222222222" },
    { ...ack, revision: 4 }, { ...ack, revision: 6 }, { ...ack, revision: Number.NaN },
  ]) assert.equal(acceptsTvReplayAck(next, bad), false);
});