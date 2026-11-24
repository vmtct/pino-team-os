import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { submitStaffRegistration } from "./staff-registration-submit";

test("PAP-2361 accepts only a confirmed pending response", async () => {
  const form = new FormData();
  let calls = 0;
  const mock: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "/api/staff-registration");
    assert.equal(init?.method, "POST");
    assert.equal(init?.body, form);
    assert.ok(init?.signal);
    return Response.json({ data: { status: "PENDING" } }, { status: 202 });
  };
  assert.deepEqual(await submitStaffRegistration(form, mock, 1000), { kind: "accepted" });
  assert.equal(calls, 1);
});

test("PAP-2361 bounds a never-resolving upload and does not retry", async () => {
  let calls = 0;
  let signal: AbortSignal | null | undefined;
  const mock: typeof fetch = (_url, init) => {
    calls++;
    signal = init?.signal;
    return new Promise(() => {});
  };
  assert.deepEqual(await submitStaffRegistration(new FormData(), mock, 10), { kind: "unknown" });
  assert.equal(calls, 1);
  assert.equal(signal?.aborted, true);
});

test("PAP-2361 bounds response-body stalls as well", async () => {
  const mock: typeof fetch = async () => {
    const response = new Response(new ReadableStream({ start() {} }), { status: 202 });
    return response;
  };
  assert.deepEqual(await submitStaffRegistration(new FormData(), mock, 10), { kind: "unknown" });
});

test("PAP-2361 handles definite validation rejection and ambiguous errors", async () => {
  for (const status of [400, 409]) {
    const mock: typeof fetch = async () => Response.json({ error: { message: "validation" } }, { status });
    assert.deepEqual(await submitStaffRegistration(new FormData(), mock, 1000), { kind: "rejected", message: "validation" });
  }
  for (const status of [200, 202, 503]) {
    const mock: typeof fetch = async () => Response.json({ error: { message: "not confirmed" } }, { status });
    assert.deepEqual(await submitStaffRegistration(new FormData(), mock, 1000), { kind: "unknown" });
  }
  const offline: typeof fetch = async () => { throw new TypeError("offline"); };
  assert.deepEqual(await submitStaffRegistration(new FormData(), offline, 1000), { kind: "unknown" });
});

test("PAP-2361 component prevents concurrent or ambiguous replay and preserves form", () => {
  const source = fs.readFileSync("app/staff/register/page.tsx", "utf8");
  assert.match(source, /if \(inFlight\.current \|\| terminalAttempt\.current\) return;/);
  assert.match(source, /terminalAttempt\.current = true;\s*setUncertain\(true\)/);
  assert.match(source, /disabled=\{busy \|\| uncertain\}/);
  assert.match(source, /finally \{\s*inFlight\.current = false;\s*setBusy\(false\)/);
  assert.doesNotMatch(source, /\.reset\(\)/);
});
