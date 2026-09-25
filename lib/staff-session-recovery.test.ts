import test from "node:test";
import assert from "node:assert/strict";
import { clearInvalidStaffPasswordSession, recoverInvalidStaffPasswordSession } from "./staff-session-recovery";

test("stale session recovery clears local password cookie through logout then redirects to login", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return new Response(JSON.stringify({ data: { revoked: true } }), { status: 200 });
  }) as typeof fetch;
  const locations: string[] = [];
  await recoverInvalidStaffPasswordSession(fetcher, { replace: (value: string | URL) => { locations.push(String(value)); } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "/api/staff-auth/logout");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.deepEqual(locations, ["/staff-login"]);
});

test("cookie cleanup remains fail-safe when logout transport is unavailable", async () => {
  const fetcher = (async () => { throw new Error("offline"); }) as typeof fetch;
  await assert.doesNotReject(clearInvalidStaffPasswordSession(fetcher));
});

test("BO layout redirects authentication failures to staff login before forbidden handling", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../app/bo/layout.tsx", import.meta.url), "utf8"));
  assert.match(source, /error instanceof BoShellGateError && error\.status === 401\) redirect\("\/staff-login"\)/);
  assert.ok(source.indexOf('error.status === 401') < source.indexOf("forbidden();"));
});

test("BO session boundary revalidates mounted sessions and recovers invalid ones", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../app/bo/BoSessionBoundary.tsx", import.meta.url), "utf8"));
  assert.match(source, /fetch\("\/api\/bo\/context"/);
  assert.match(source, /response\.status === 401/);
  assert.match(source, /recoverInvalidStaffPasswordSession\(\)/);
  assert.match(source, /\}, \[pathname\]\)/);
});

test("BO layout composes the session boundary outside the presentation shell", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../app/bo/layout.tsx", import.meta.url), "utf8"));
  assert.match(source, /<BoSessionBoundary>/);
  assert.ok(source.indexOf("<BoSessionBoundary>") < source.indexOf("<BoShell"));
});
