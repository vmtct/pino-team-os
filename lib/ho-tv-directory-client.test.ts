/** PAP-1419 / PNR-TV (PAP-650): read-only Founder HO TV client contract tests. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  HoTvDirectoryError, loadHoTvDirectory, loadHoTvOperatorHealth,
} from "./ho-tv-directory-client";

const centerId = "019b1126-0001-7000-8000-000000000001";
const displayId = "019b1126-0001-7000-8000-000000000002";
const deviceId = "019b1126-0001-7000-8000-000000000003";
const display = {
  id: displayId, key: "tv-ct", displayName: "Ambient Welcome", description: null,
  runtimeType: "PINORIA_HOUSE", scopeType: "CENTER", scopeId: centerId,
  centerName: "Cần Thơ", orientation: "LANDSCAPE", targetAspectRatio: "16:9",
  definitionVersion: 3, status: "ACTIVE",
  metadata: { runtimeToken: "MUST_NOT_LEAK" },
};
const device = {
  id: deviceId, key: "device-ct", displayName: "Reception Pinoria",
  centerId, centerName: "Cần Thơ", status: "ACTIVE",
  defaultDisplayId: displayId, defaultDisplayName: "Ambient Welcome",
  lastSeenAt: null, actualOrientation: null, viewportWidth: null,
  viewportHeight: null, metadata: { secret: "MUST_NOT_LEAK" },
};
const response = (data: unknown, status = 200, code?: string): Response =>
  Response.json(status === 200 ? { data } : { error: { code: code ?? "ACCESS_PERMISSION_DENIED" } },
    { status, headers: { "x-request-id": "core-tv-read-id", "cache-control": "no-store" } });

test("PAP-1419 HO TV directory uses only exact GET/no-store same-origin BFF, retains Core-filtered truth", async () => {
  const called: string[] = [];
  const controller = new AbortController();
  const fetcher: typeof fetch = async (input, init) => {
    const path = String(input);
    called.push(path);
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.signal, controller.signal);
    if (path === "/api/ho/pinoria/tv-health/displays") return response([display]);
    if (path === "/api/ho/pinoria/tv-health/devices") return response([device]);
    throw Error("Unapproved extra route");
  };
  const result = await loadHoTvDirectory(fetcher, controller.signal);
  assert.deepEqual(called.sort(), [
    "/api/ho/pinoria/tv-health/devices", "/api/ho/pinoria/tv-health/displays",
  ].sort());
  assert.equal(result.displays.requestId, "core-tv-read-id");
  assert.equal(result.devices.requestId, "core-tv-read-id");
  assert.equal(result.displays.data.length, 1);
  assert.equal(result.devices.data.length, 1);
  assert.equal(result.devices.data[0]?.lastSeenAt, null);
  assert.equal(result.devices.data[0]?.viewportWidth, null);
  assert.equal(result.displays.data[0]?.targetAspectRatio, "16:9");
  assert.ok(!JSON.stringify(result).includes("MUST_NOT_LEAK"));
});

test("PAP-1419 Center health preserves false heartbeat/ACK and absent observation", async () => {
  const session = {
    sessionId: "019b1126-0001-7000-8000-000000000004",
    deviceId, displayId,
    lastSeenAt: "2026-11-05T00:00:00.000Z", expiresAt: "2026-11-05T00:05:00.000Z",
    definitionVersion: 3, runtimeType: "PINORIA_HOUSE",
    heartbeatFresh: false, rendererAcknowledged: false,
    observationStatus: "NONE", latestObservation: null,
  };
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    assert.equal(String(input), "/api/ho/pinoria/tv-health/operator-health?centerId=" + centerId);
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    return response({ centerId, deviceSessions: [session] });
  };
  const result = await loadHoTvOperatorHealth(centerId, fetcher);
  assert.equal(calls, 1);
  assert.equal(result.requestId, "core-tv-read-id");
  assert.equal(result.data.deviceSessions[0]?.heartbeatFresh, false);
  assert.equal(result.data.deviceSessions[0]?.rendererAcknowledged, false);
  assert.equal(result.data.deviceSessions[0]?.observationStatus, "NONE");
  assert.equal(result.data.deviceSessions[0]?.latestObservation, null);
});

test("PAP-1419 never turns 401/403 into empty success or 'online'", async () => {
  for (const status of [401, 403]) {
    const fetcher: typeof fetch = async () => response(null, status, "TV_HO_ACCESS_DENIED");
    await assert.rejects(
      loadHoTvDirectory(fetcher),
      error => error instanceof HoTvDirectoryError && error.status === status &&
        error.code === "TV_HO_ACCESS_DENIED",
    );
    await assert.rejects(
      loadHoTvOperatorHealth(centerId, fetcher),
      error => error instanceof HoTvDirectoryError && error.status === status,
    );
  }
});

test("PAP-1419 invalid Center is blocked before network and cannot inject query", () => {
  let called = false;
  const fetcher: typeof fetch = async () => { called = true; throw Error("SHOULD_NOT_FETCH"); };
  for (const value of ["", "wrong", centerId + "&x=y", "019b1126-0001-4000-8000-000000000001"])
    assert.throws(
      () => loadHoTvOperatorHealth(value, fetcher),
      error => error instanceof HoTvDirectoryError && error.status === 400,
    );
  assert.equal(called, false);
});

test("PAP-1419 malformed Core payloads fail closed, never synthetic rows or ACK", async () => {
  const invalidDisplays: typeof fetch = async input =>
    String(input).endsWith("/displays") ? response([{ ...display, scopeType: "BOGUS" }]) : response([device]);
  await assert.rejects(loadHoTvDirectory(invalidDisplays), error =>
    error instanceof HoTvDirectoryError && error.status === 502);
  const invalidHealth: typeof fetch = async () => response({
    centerId, deviceSessions: [{
      sessionId: "019b1126-0001-7000-8000-000000000004",
      deviceId, displayId, lastSeenAt: "2026-11-05T00:00:00.000Z",
      expiresAt: "2026-11-05T00:05:00.000Z", definitionVersion: 3,
      runtimeType: "PINORIA_HOUSE", heartbeatFresh: "maybe",
      rendererAcknowledged: true, observationStatus: "FRESH", latestObservation: null,
    }],
  });
  await assert.rejects(loadHoTvOperatorHealth(centerId, invalidHealth), error =>
    error instanceof HoTvDirectoryError && error.status === 502);
  const mismatch: typeof fetch = async () => response({ centerId: displayId, deviceSessions: [] });
  await assert.rejects(loadHoTvOperatorHealth(centerId, mismatch), error =>
    error instanceof HoTvDirectoryError && error.status === 502);
});
