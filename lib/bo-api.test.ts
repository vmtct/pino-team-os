import test from "node:test";
import assert from "node:assert/strict";
import { boApi } from "./bo-api";

test("BO client no longer exposes manager-controlled Staff PIN configuration", () => {
  assert.equal("configureStaffPin" in boApi, false);
});

test("Open Studio Pass control posts only canonical Core command fields", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ path: string; body: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ path: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json({ data: {} });
  };
  try {
    await boApi.assignOpenStudioMemberCenter({ houseMembershipId: "house-1", centerId: "center-1", effectiveFrom: "2026-08-30T02:00:00.000Z" });
    await boApi.reassignOpenStudioMemberCenter({ houseMembershipId: "house-1", centerId: "center-2", effectiveFrom: "2026-08-30T03:00:00.000Z", assignmentReason: "Center move" });
    await boApi.issueOpenStudioBringAFriendPass({ houseMembershipId: "house-1", effectiveAt: "2026-08-30T04:00:00.000Z" });
    await boApi.revokeOpenStudioPass("pass-1", { revokedAt: "2026-08-30T05:00:00.000Z", reason: "Administrative correction" });
  } finally { globalThis.fetch = original; }
  assert.deepEqual(calls, [
    { path: "/api/bo/open-studio/member-centers/assign", body: { houseMembershipId: "house-1", centerId: "center-1", effectiveFrom: "2026-08-30T02:00:00.000Z" } },
    { path: "/api/bo/open-studio/member-centers/reassign", body: { houseMembershipId: "house-1", centerId: "center-2", effectiveFrom: "2026-08-30T03:00:00.000Z", assignmentReason: "Center move" } },
    { path: "/api/bo/open-studio/passes/issue-bring-a-friend", body: { houseMembershipId: "house-1", effectiveAt: "2026-08-30T04:00:00.000Z" } },
    { path: "/api/bo/open-studio/passes/pass-1/revoke", body: { revokedAt: "2026-08-30T05:00:00.000Z", reason: "Administrative correction" } },
  ]);
});


test("Open Studio policy client preserves versioned draft/publish semantics", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ path: string; body: unknown; key: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ path: String(input), body: init?.body ? JSON.parse(String(init.body)) : null, key: new Headers(init?.headers).get("idempotency-key") });
    return Response.json({ data: { streamId: "stream", versionId: "version", version: 1, revision: 1, published: true } });
  };
  try {
    const target = { targetType: "GLOBAL" as const, targetId: null };
    const value = { passReleaseCutoffMinutesBeforeStart: 180 };
    await boApi.createOpenStudioPolicyDraft("cancellation.v1", target, value, "Move cutoff", 0);
    await boApi.publishOpenStudioPolicy("cancellation.v1", "0198d050-56c1-7ac5-b9ab-b0e45d912345", target, "2026-09-01T00:00:00.000Z", 1);
  } finally { globalThis.fetch = original; }
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0]!.body, { targetType: "GLOBAL", targetId: null, value: { passReleaseCutoffMinutesBeforeStart: 180 }, changeReason: "Move cutoff", expectedRevision: 0 });
  assert.deepEqual(calls[1]!.body, { targetType: "GLOBAL", targetId: null, effectiveFrom: "2026-09-01T00:00:00.000Z", expectedRevision: 1 });
  assert.ok(calls.every((item) => item.key && item.key.length > 10));
});

test("Duty Exception client consumes every Core page so older requests remain reachable", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (!url.includes("cursor=")) return Response.json({ data: [{ exception: { id: "newest" } }], page: { nextCursor: "cursor-1" } });
    if (url.includes("cursor=cursor-1")) return Response.json({ data: [{ exception: { id: "middle" } }], page: { nextCursor: "cursor-2" } });
    return Response.json({ data: [{ exception: { id: "old-requested" } }], page: { nextCursor: null } });
  };
  try {
    const rows = await boApi.dutyExceptions("center-1");
    assert.deepEqual(rows.map((row) => row.exception.id), ["newest", "middle", "old-requested"]);
  } finally { globalThis.fetch = original; }
  assert.deepEqual(calls, [
    "/api/bo/workforce/duty/checkout-exceptions?centerId=center-1&limit=200",
    "/api/bo/workforce/duty/checkout-exceptions?centerId=center-1&limit=200&cursor=cursor-1",
    "/api/bo/workforce/duty/checkout-exceptions?centerId=center-1&limit=200&cursor=cursor-2",
  ]);
});

test("Duty Exception client fails closed on a repeated pagination cursor", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ data: [], page: { nextCursor: "same-cursor" } });
  };
  try {
    await assert.rejects(() => boApi.dutyExceptions("center-1"), /pagination cursor repeated/i);
  } finally { globalThis.fetch = original; }
  assert.equal(calls, 2);
});
