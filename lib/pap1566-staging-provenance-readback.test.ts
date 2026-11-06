import test from "node:test";
import assert from "node:assert/strict";
import { attestStagingProvenance } from "../scripts/pap1566-staging-provenance-readback.mjs";

const url = "https://staging.example.test/pap659-build-provenance.json";
const wanted = "a".repeat(64), old = "b".repeat(64);
const payload = digest => new Response(JSON.stringify({
  schemaVersion: 1, kind: "NEXT_BUILD_MANIFEST_SHA256", digest,
}), { status: 200, headers: { "Content-Type": "application/json" } });

test("PAP-1566: valid stale asset converges to exact digest within bounded attempts", async () => {
  let calls = 0, delays = 0;
  const result = await attestStagingProvenance(url, wanted, {
    fetcher: async () => ++calls < 3 ? payload(old) : payload(wanted),
    pause: async ms => { assert.equal(ms, 2000); delays++; },
  });
  assert.deepEqual(result, { digest: wanted, attempt: 3 });
  assert.equal(calls, 3); assert.equal(delays, 2);
});

test("PAP-1566: persistent valid mismatch fails closed after bounded attempts", async () => {
  let calls = 0, waits = 0;
  await assert.rejects(attestStagingProvenance(url, wanted, {
    fetcher: async () => { calls++; return payload(old); },
    pause: async () => { waits++; },
  }), /PAP1566_PROVENANCE_TERMINAL_MISMATCH/);
  assert.equal(calls, 5); assert.equal(waits, 4);
});

test("PAP-1566: forbidden HTTP, malformed JSON and wrong schema never retry", async () => {
  for (const response of [
    new Response("", { status: 403 }),
    new Response("<html>wrong</html>", { status: 200 }),
    new Response(JSON.stringify({ schemaVersion: 2, kind: "NEXT_BUILD_MANIFEST_SHA256", digest: wanted }), { status: 200 }),
    new Response(JSON.stringify({ schemaVersion: 1, kind: "OTHER", digest: wanted }), { status: 200 }),
  ]) {
    let calls = 0, waits = 0;
    await assert.rejects(attestStagingProvenance(url, wanted, {
      fetcher: async () => { calls++; return response; },
      pause: async () => { waits++; },
    }), /PAP1566_PROVENANCE_(HTTP_403|INVALID_JSON|INVALID_SCHEMA)/);
    assert.equal(calls, 1); assert.equal(waits, 0);
  }
});

test("PAP-1566: invalid URL/digest/attempts rejected before fetch", async () => {
  for (const [source, digest, options] of [
    ["http://staging.example.test/pap659-build-provenance.json", wanted, {}],
    [url + "?digest=anything", wanted, {}],
    [url, "forged", {}],
    [url, wanted, { attempts: 1000 }],
  ]) {
    let invoked = false;
    await assert.rejects(attestStagingProvenance(source, digest, {
      fetcher: async () => { invoked = true; return payload(wanted); }, ...options,
    }), /PAP1566_INVALID_PROVENANCE_PREFLIGHT/);
    assert.equal(invoked, false);
  }
});
