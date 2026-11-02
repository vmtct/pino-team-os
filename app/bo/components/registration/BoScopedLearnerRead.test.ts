import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { scopedLearnerFetcher } from "./BoScopedLearnerRead";
import { boCenterWave1Href, isBoCenterReadWave1 } from "./BoCenterWave1";

const { load } = createRequire(import.meta.url)("../../../../public/bo-authority-source/school-adapters.js");
const A = "0199f001-0000-7000-8000-000000000001";
const B = "0199f001-0000-7000-8000-000000000002";
const student = { id: "0199f001-0000-7000-8000-000000000003", displayName: "Synthetic Learner", activePaths: [], status: "ACTIVE", birthYear: 2020, houseMember: false };
const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });

test("PAP-1328: Students directory calls only the selected Core Center", async () => {
  assert.equal(isBoCenterReadWave1("students"), true);
  const calls: string[] = [];
  const rows = await load("students", scopedLearnerFetcher(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return ok([student]);
  }, A), { centerId: A });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Synthetic Learner");
  assert.deepEqual(calls, ["/api/bo/learners?limit=100&centerId=" + A]);
  assert.equal(boCenterWave1Href("/bo?module=students&record=old#detail", "students", A, [A]), "/bo?module=students&centerId=" + A);
  assert.equal(boCenterWave1Href("/bo?module=students", "students", B, [A]), "/bo?module=students");
});

test("PAP-1328: Student pagination preserves the exact selected Center on every page", async () => {
  let count = 0;
  const rows = await load("students", scopedLearnerFetcher(async (input: RequestInfo | URL) => {
    const url = new URL("https://bo.invalid" + String(input));
    assert.equal(url.searchParams.get("centerId"), A);
    count++;
    if (count === 1) return ok(Array.from({length:100}, (_, i) => ({ ...student, id: "0199f001-0000-7000-8000-" + String(i + 100).padStart(12, "0") })));
    assert.ok(url.searchParams.has("beforeStudentId"));
    return ok([student]);
  }, A), { centerId: A });
  assert.equal(count, 2);
  assert.equal(rows.length, 101);
});

test("PAP-1328: invalid or foreign Center is rejected before any unscoped read", async () => {
  let calls = 0;
  const fetcher = async (_input: RequestInfo | URL) => { calls++; return ok([student]); };
  assert.throws(() => scopedLearnerFetcher(fetcher as typeof fetch, "forged"), /xác thực/);
  const scoped = scopedLearnerFetcher(fetcher as typeof fetch, A);
  await assert.rejects(scoped("/api/bo/learners?centerId=" + B), /khác cơ sở/);
  await assert.rejects(scoped("/api/bo/subscriptions"), /ngoài phạm vi/);
  assert.equal(calls, 0);
});

test("PAP-1328: Core 403 never retries learner read without a Center", async () => {
  const calls: string[] = [];
  await assert.rejects(load("students", scopedLearnerFetcher(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(null, { status: 403 });
  }, A), { centerId: A }), /Core từ chối/);
  assert.deepEqual(calls, ["/api/bo/learners?limit=100&centerId=" + A]);
});
