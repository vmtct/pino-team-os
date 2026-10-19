import assert from "node:assert/strict";
import { test } from "node:test";
import { operatorPresentationClient, OperatorPresentationError } from "./operator-presentation-client";

test("operator queue uses authenticated TOS facade, not the TV relay", async () => {
  const previous = globalThis.fetch;
  const calls: Array<[string, RequestInit]> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return Response.json({ data: { current: null, queued: [], hasMore: false, revision: 0 } });
  }) as typeof fetch;
  try {
    const result = await operatorPresentationClient.queue("center/1");
    assert.equal(result.revision, 0);
    assert.equal(calls[0]?.[0], "/api/tos-learning/pinoria/presentations/queue?centerId=center%2F1");
    assert.equal(calls[0]?.[1].cache, "no-store");
  } finally { globalThis.fetch = previous; }
});

test("close refuses missing safety tokens before transport", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("must not call transport"); }) as typeof fetch;
  try {
    assert.throws(() => operatorPresentationClient.close("c", "p", "", "receipt"), /claim token/);
    assert.throws(() => operatorPresentationClient.close("c", "p", "claim", " "), /idempotency key/);
  } finally { globalThis.fetch = previous; }
});

test("close supplies both claim CAS and idempotency to the authorized Core facade", async () => {
  const previous = globalThis.fetch;
  const calls: Array<[string, RequestInit]> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return Response.json({ data: { presentationId: "p", completedAt: "done" } });
  }) as typeof fetch;
  try {
    assert.equal((await operatorPresentationClient.close("c", "p", "claim", "receipt")).completedAt, "done");
    assert.equal(calls[0]?.[0], "/api/tos-learning/pinoria/presentations/close");
    assert.equal(calls[0]?.[1].method, "POST");
    assert.equal(new Headers(calls[0]?.[1].headers).get("idempotency-key"), "receipt");
    assert.deepEqual(JSON.parse(calls[0]?.[1].body as string), {
      centerId: "c", presentationId: "p", expectedClaimedAt: "claim",
    });
  } finally { globalThis.fetch = previous; }
});

test("replay is snapshot inspection only; ACL failures are propagated", async () => {
  const previous = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    return Response.json({ error: { code: "FORBIDDEN", message: "Center denied" } }, { status: 403 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      operatorPresentationClient.replaySnapshotInspect("c", "p"),
      (error: unknown) => error instanceof OperatorPresentationError &&
        error.status === 403 && error.code === "FORBIDDEN",
    );
    assert.deepEqual(calls, ["/api/tos-learning/pinoria/presentations/replay-snapshot"]);
  } finally { globalThis.fetch = previous; }
});

test("return-to-ambient uses authenticated Core command path and persists safety tokens", async () => {
  const previous = globalThis.fetch;
  const calls: Array<[string, RequestInit]> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return Response.json({ data: { presentationId: "p", completedAt: "done" } });
  }) as typeof fetch;
  try {
    await operatorPresentationClient.returnToAmbient("c", "p", "claim", "receipt");
    assert.equal(calls[0]?.[0], "/api/tos-learning/pinoria/presentations/return-to-ambient");
    assert.equal(new Headers(calls[0]?.[1].headers).get("idempotency-key"), "receipt");
    assert.deepEqual(JSON.parse(calls[0]?.[1].body as string), {
      centerId: "c", presentationId: "p", expectedClaimedAt: "claim",
    });
  } finally { globalThis.fetch = previous; }
});

test("view-only snapshot uses GET and encoded scope, without requiring control authority", async () => {
  const previous = globalThis.fetch;
  const calls: Array<[string, RequestInit]> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return Response.json({ data: { id: "p", kind: "WELCOME", claimedAt: "now", projection: {} } });
  }) as typeof fetch;
  try {
    const snapshot = await operatorPresentationClient.inspectSnapshot("center/1", "presentation/2");
    assert.equal(snapshot.id, "p");
    assert.equal(calls[0]?.[0], "/api/tos-learning/pinoria/presentations/snapshot?centerId=center%2F1&presentationId=presentation%2F2");
    assert.equal(calls[0]?.[1].method, undefined);
    assert.equal(calls[0]?.[1].cache, "no-store");
  } finally { globalThis.fetch = previous; }
});
