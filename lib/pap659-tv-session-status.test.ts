import assert from "node:assert/strict";
import { test } from "node:test";
import { describeDeviceSession } from "./pap659-tv-session-status";

const device = { id: "device-a", centerId: "center-a" };
const recent = { sessionId: "session-a", deviceId: "device-a", displayId: "display-a", lastSeenAt: "2026-10-21T02:00:00.000Z", heartbeatFresh: true };
const stale = { ...recent, heartbeatFresh: false };

test("PAP-659: only one matching, scoped Core session can be reported", () => {
  const result = describeDeviceSession({ centerId: "center-a", deviceSessions: [
    { ...recent, deviceId: "other-device" }, recent,
  ] }, "center-a", device);
  assert.deepEqual(result, { kind: "recent-heartbeat", sessionId: "session-a", displayId: "display-a", lastSeenAt: recent.lastSeenAt });
  assert.equal(describeDeviceSession({ centerId: "center-a", deviceSessions: [stale] }, "center-a", device).kind, "stale-heartbeat");
});

test("PAP-659: stale center, missing snapshot and foreign device fail closed", () => {
  const health = { centerId: "center-a", deviceSessions: [recent] };
  assert.equal(describeDeviceSession(null, "center-a", device).kind, "unverified");
  assert.equal(describeDeviceSession(health, "center-b", device).kind, "unverified");
  assert.equal(describeDeviceSession(health, "center-a", { ...device, centerId: "center-b" }).kind, "unverified");
  assert.equal(describeDeviceSession(health, "center-a", { ...device, id: "other-device" }).kind, "not-observed");
});

test("PAP-659: more than one physical session is ambiguous, never an assumed target", () => {
  assert.deepEqual(describeDeviceSession({
    centerId: "center-a", deviceSessions: [recent, { ...recent, sessionId: "session-b" }],
  }, "center-a", device), { kind: "ambiguous", sessionId: null, displayId: null, lastSeenAt: null });
});
