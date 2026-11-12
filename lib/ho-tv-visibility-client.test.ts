/** PAP-1385 / Epic PAP-650 PNR-TV: persisted HO visibility client CAS/readback guard. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  selectedTvCenter, parseTvVisibility, makeTvVisibilityDraft,
  readTvVisibility, saveTvVisibility, TvVisibilityClientError,
  type TvLiveVisibility, type TvVisibilityCenter,
} from "./ho-tv-visibility-client";
const center = "019d1000-0001-7000-8000-000000000001";
const other = "019d1000-0001-7000-8000-000000000002";
const unknown = "019d1000-0001-7000-8000-0000000000ff";
const centers: TvVisibilityCenter[] = [{ id: center, name: "Cần Thơ" }, { id: other, name: "Demo" }];
const ref = "tvp1-center-" + center;
const stamp = "2026-11-11T03:00:00.000Z";
const original: TvLiveVisibility = {
  id: ref, originCenterId: center, name: "Ambient Welcome", scope: "CENTER",
  assignedCenterIds: [center], revision: 1,
  createdAt: stamp, createdByUserId: center, updatedAt: stamp, updatedByUserId: center,
};
const envelope = (data: unknown) => ({ data });
const result = (data: unknown, status = 200) =>
  new Response(JSON.stringify(status === 200 ? envelope(data) : { error: { code: "DENIED" } }), {
    status, headers: { "content-type": "application/json" },
  });
test("PAP-1385 selected Center bound to Core directory/immutable policy origin", () => {
  assert.equal(selectedTvCenter(ref, centers), center);
  assert.equal(selectedTvCenter("tvp1-default", centers), center);
  assert.equal(selectedTvCenter(ref, [{ id: other, name: "Other" }]), null);
  assert.equal(selectedTvCenter("tvp1-center-bogus", centers), null);
  assert.equal(selectedTvCenter("tvp1-default", []), null);
});
test("PAP-1385 reject any invalid/mismatched Core projection or unexpected assigned Center", () => {
  assert.deepEqual(parseTvVisibility(envelope(original), ref, centers), original);
  for (const bad of [
    { ...original, id: "tvp1-default" },
    { ...original, originCenterId: null },
    { ...original, name: "PINO " },
    { ...original, name: "" },
    { ...original, scope: "ALL" },
    { ...original, scope: "DEFAULT" },
    { ...original, assignedCenterIds: [unknown] },
    { ...original, assignedCenterIds: [center, center] },
    { ...original, revision: -1 },
    { ...original, revision: 1.5 },
    { ...original, updatedAt: 0 },
    { ...original, updatedByUserId: "spoofed" },
  ]) assert.throws(() => parseTvVisibility(envelope(bad), ref, centers), TvVisibilityClientError);
});
test("PAP-1385 Core GET no-store, auth cookie and verified exact policy", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const request = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), init }); return result(original);
  };
  const read = await readTvVisibility(ref, center, centers, request);
  assert.deepEqual(read, original);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path,
    "/api/ho/pinoria/tv-policies/visibility/" + ref + "?selectedCenterId=" + center);
  assert.equal(calls[0].init?.credentials, "same-origin");
  assert.equal(calls[0].init?.cache, "no-store");
  assert.equal(calls[0].init?.method, "GET");
});
test("PAP-1385 no-op never writes; invalid Center, Scope or Name fails before Core", async () => {
  let count = 0;
  const request = async () => { count++; return result(original); };
  assert.equal(await saveTvVisibility(original, center, {
    name: original.name, scope: original.scope, assignedCenterIds: original.assignedCenterIds,
  }, centers, request), original);
  assert.equal(count, 0);
  for (const bad of [
    { name: "  spaces", scope: "CENTER" as const, assignedCenterIds: [center] },
    { name: "ok", scope: "CENTER" as const, assignedCenterIds: [unknown] },
    { name: "ok", scope: "DEFAULT" as const, assignedCenterIds: [center] },
    { name: "ok", scope: "CENTER" as const, assignedCenterIds: [center, center] },
  ]) assert.throws(() => makeTvVisibilityDraft(original, bad, centers), TvVisibilityClientError);
  await assert.rejects(() => saveTvVisibility(original, unknown, {
    name: "safe", scope: "CENTER", assignedCenterIds: [center],
  }, centers, request), TvVisibilityClientError);
  assert.equal(count, 0);
});
test("PAP-1385 single strict PATCH then verified independent GET readback", async () => {
  const saved = { ...original, name: "Ambient Welcome 2", revision: 2, updatedAt: "2026-11-11T03:01:00Z" };
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const request = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ path: String(input), init });
    return result(saved);
  };
  const done = await saveTvVisibility(original, center, {
    name: saved.name, scope: "CENTER", assignedCenterIds: [center],
  }, centers, request);
  assert.equal(done.revision, 2);
  assert.deepEqual(calls.map(c => c.init?.method), ["PATCH", "GET"]);
  assert.equal(calls[0].init?.headers &&
    (calls[0].init.headers as Record<string, string>)["content-type"], "application/json");
  assert.equal(calls[0].init?.credentials, "same-origin");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    selectedCenterId: center, name: saved.name, scope: "CENTER",
    assignedCenterIds: [center], expectedRevision: 1,
  });
});
test("PAP-1385 stale CAS stops with 409, no retry and no fake success", async () => {
  let count = 0;
  const request = async () => { count++; return result(null, 409); };
  await assert.rejects(() => saveTvVisibility(original, center, {
    name: "Updated", scope: "CENTER", assignedCenterIds: [center],
  }, centers, request), (err: unknown) => err instanceof TvVisibilityClientError &&
    err.code === "CONFLICT" && err.status === 409);
  assert.equal(count, 1);
});
test("PAP-1385 post-PATCH mismatch fails closed without retrying the write", async () => {
  let count = 0;
  const request = async () => {
    count++; return result(count === 1 ? { ...original, name: "New", revision: 2 }
      : { ...original, name: "Old", revision: 2 });
  };
  await assert.rejects(() => saveTvVisibility(original, center, {
    name: "New", scope: "CENTER", assignedCenterIds: [center],
  }, centers, request), (err: unknown) => err instanceof TvVisibilityClientError &&
    err.code === "VERIFY");
  assert.equal(count, 2);
});
test("PAP-1385 negative GET statuses are returned exactly as denial", async () => {
  for (const [status, code] of [
    [401, "LOGIN"], [403, "DENIED"], [404, "MISSING"], [409, "CONFLICT"], [400, "INVALID"],
  ] as const) {
    const request = async () => result(null, status);
    await assert.rejects(() => readTvVisibility(ref, center, centers, request),
      (err: unknown) => err instanceof TvVisibilityClientError &&
        err.code === code && err.status === status);
  }
});
