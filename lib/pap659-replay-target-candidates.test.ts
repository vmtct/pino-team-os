import test from "node:test";
import assert from "node:assert/strict";
import { targetMatchesSelected, verifiedReplayCandidates } from "../app/pinoria/tv-operator/replay-target-candidates";
import type { OperatorDeviceSession, OperatorHealth } from "@/app/pinoria-tv/operator-presentation-client";

const candidate: OperatorDeviceSession = {
  sessionId: "session-a", deviceId: "device-a", displayId: "display-a",
  lastSeenAt: "2026-10-21T03:00:00Z", expiresAt: "2026-10-22T03:00:00Z",
  definitionVersion: 1, runtimeType: "PINORIA_HOUSE", heartbeatFresh: true,
  latestReplayCommandId: null, latestReplayResolution: null, latestReplayDispatchedAt: null, latestReplayResolvedAt: null,
};
const health = (sessions: OperatorDeviceSession[], centerId = "center-a") =>
  ({ centerId, deviceSessions: sessions }) as OperatorHealth;

test("PAP-659 candidate list is limited to fresh sessions from the selected Center", () => {
  const other = { ...candidate, sessionId: "session-b", heartbeatFresh: false };
  assert.deepEqual(verifiedReplayCandidates(health([candidate, other]), "center-a"), [candidate]);
  assert.deepEqual(verifiedReplayCandidates(health([candidate]), "center-b"), []);
  assert.deepEqual(verifiedReplayCandidates(health([candidate], "center-b"), "center-a"), []);
});

test("PAP-659 ambiguous and malformed identity hints are not selectable", () => {
  const malformed = { ...candidate, sessionId: "", deviceId: "" };
  assert.deepEqual(verifiedReplayCandidates(health([candidate, { ...candidate }, malformed]), "center-a"), []);
});

test("PAP-659 replay preflight must match ALL three selected target keys", () => {
  const target = { displayId: candidate.displayId, deviceId: candidate.deviceId, sessionId: candidate.sessionId };
  assert.equal(targetMatchesSelected(candidate, target), true);
  assert.equal(targetMatchesSelected(candidate, { ...target, deviceId: "device-b" }), false);
  assert.equal(targetMatchesSelected(candidate, { ...target, sessionId: "session-b" }), false);
  assert.equal(targetMatchesSelected(candidate, { ...target, displayId: "display-b" }), false);
  assert.equal(targetMatchesSelected(candidate, null), false);
});
