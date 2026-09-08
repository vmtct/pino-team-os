import test from "node:test";
import assert from "node:assert/strict";
import { workforceApi } from "./workforce-api";

test("timekeeping client forwards caller-owned idempotency keys", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json({ data: { id: "session", centerId: "center", assignmentId: "assignment", workDate: "2026-09-08", status: "OPEN", checkInAt: "2026-09-08T01:00:00.000Z", checkOutAt: null } });
  };
  try {
    await workforceApi.checkIn("center", "assignment", "retry-check-in");
    await workforceApi.checkOut("retry-check-out");
  } finally { globalThis.fetch = original; }
  assert.deepEqual(calls.map((call) => call.url), ["/api/workforce/timekeeping/check-in", "/api/workforce/timekeeping/check-out"]);
  assert.deepEqual(calls.map((call) => new Headers(call.init?.headers).get("idempotency-key")), ["retry-check-in", "retry-check-out"]);
  assert.deepEqual(calls.map((call) => JSON.parse(String(call.init?.body))), [{ centerId: "center", assignmentId: "assignment" }, {}]);
});
