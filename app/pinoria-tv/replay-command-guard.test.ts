import assert from "node:assert/strict";
import { test } from "node:test";
import { acceptsTvReplayInstruction } from "./replay-command-guard";
const current = { centerId: "center-a", displayId: "display-a", sessionId: "session-a", revision: 4 };
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
  for (const invalid of [{ ...current, sessionId: "" }, { ...current, revision: -1 }]) {
    assert.equal(acceptsTvReplayInstruction(invalid, next), false);
  }
});
