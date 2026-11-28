import test from "node:test";
import assert from "node:assert/strict";
import { initialStaffDirectoryFetch } from "./initial-directory-fetch";
import { createHoTddAdapter } from "@/lib/workspace-adapters";
import { TddRegistry } from "@/lib/workspace-schema";
import { staffExpectedPrincipalHeader } from "@/lib/ho-manual-staff-create-client";
import { nativeManualStaffProvider } from "./native-staff-provider";
import { manualStaffDefinition, manualStaffQuery } from "./manual-create-contract";

const origin = "https://ho.staging.pinohouse.art";
const listPath = "/api/ho/staff/directory";
const lifetime = () => new AbortController().signal;
function fixture(status = 200, mismatchOnPost = false) {
  const calls: string[] = [];
  let contexts = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    if (path === listPath) {
      assert.equal(new Headers(init?.headers).get(staffExpectedPrincipalHeader), "principal-A");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.credentials, "same-origin");
      assert.equal(init?.redirect, "error");
      return Response.json({ data: [] }, { status });
    }
    assert.equal(path, "/api/bo/context");
    const userId = mismatchOnPost && ++contexts === 3 ? "principal-B" : "principal-A";
    return Response.json({ data: { userId, surface: "BO", entitled: true, permissionKeys: ["team.bo.access", "bo.operations.view"] } });
  };
  return { fetcher, calls };
}
async function build(fetcher: typeof fetch, signal: AbortSignal) {
  return createHoTddAdapter({ origin, fetcher, registry: new TddRegistry(), definition: manualStaffDefinition, provider: nativeManualStaffProvider }, signal);
}
test("starts exact list before adapter bootstrap, preserves both list guards and consumes it once", async () => {
  const { fetcher, calls } = fixture();
  const signal = lifetime();
  const eager = initialStaffDirectoryFetch(origin, "principal-A", signal, fetcher);
  assert.deepEqual(calls, [listPath]);
  const adapter = await build(eager, signal);
  assert.equal((await adapter.list(manualStaffQuery, signal)).total, 0);
  assert.deepEqual(calls, [listPath, "/api/bo/context", "/api/bo/context", "/api/bo/context"]);
  await adapter.list(manualStaffQuery, signal);
  assert.equal(calls.filter(p => p === listPath).length, 2);
  adapter.dispose();
});

test("prefetched 401 revokes the existing session; actor replacement still prevents list publication", async () => {
  for (const [code, mismatch] of [[401, false], [200, true]] as const) {
    const { fetcher, calls } = fixture(code, mismatch);
    const signal = lifetime();
    const adapter = await build(initialStaffDirectoryFetch(origin, "principal-A", signal, fetcher), signal);
    await assert.rejects(adapter.list(manualStaffQuery, signal), { status: 401 });
    assert.equal(adapter.context.authorize("team.bo.access"), false);
    assert.equal(calls.filter(p => p === listPath).length, 1);
    adapter.dispose();
  }
});

test("does not start elsewhere or with an invalid principal; canceled mount cannot consume the read", async () => {
  const { fetcher, calls } = fixture();
  const controller = new AbortController();
  assert.equal(initialStaffDirectoryFetch("https://bo.staging.pinohouse.art", "principal-A", lifetime(), fetcher), fetcher);
  assert.equal(initialStaffDirectoryFetch(origin, "bad actor", lifetime(), fetcher), fetcher);
  assert.equal(calls.length, 0);
  const eager = initialStaffDirectoryFetch(origin, "principal-A", controller.signal, fetcher);
  controller.abort();
  await assert.rejects(eager(origin + listPath, { method: "GET" }), { name: "AbortError" });
});
