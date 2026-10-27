import assert from "node:assert/strict";
import { test } from "node:test";
import type { BoLearnerLifecycle } from "./bo-model";
import { latestStudentSubscription } from "./bo-student-latest-subscription";

function fixture(items: {
  id: string; start?: string | null; owner?: string; status?: string;
  path?: string; remaining?: number; end?: string | null;
}[]): BoLearnerLifecycle {
  return {
    student: { id: "student-1", displayName: "Học viên mẫu" },
    subscriptions: items.map(item => ({
      subscription: {
        id: item.id,
        studentProfileId: item.owner ?? "student-1",
        serviceStartsOn: item.start ?? null,
        contractualEndsOn: item.end ?? null,
        pathDisplayName: item.path ?? "Art",
        lifecycle: item.status ?? "ACTIVE",
        weeklyCommitment: 2,
        effectiveAvailableUnits: item.remaining ?? 18,
        commercialReference: null,
      },
      enrollments: [],
    })),
  } as unknown as BoLearnerLifecycle;
}

test("latest Subscription is chosen by service start, not ACTIVE preference", () => {
  const result = latestStudentSubscription(fixture([
    { id: "older-active", start: "2026-08-01", status: "ACTIVE" },
    { id: "new-draft", start: "2026-10-27", status: "DRAFT", remaining: 0, end: "2027-01-24" },
    { id: "mid-cancelled", start: "2026-09-05", status: "CANCELLED" },
  ]), "student-1");
  assert.equal(result?.id, "new-draft");
  assert.equal(result?.status, "DRAFT");
  assert.equal(result?.remaining, 0);
  assert.equal(result?.end, "2027-01-24");
});

test("latest Subscription date ties are deterministic", () => {
  const items = [
    { id: "aa", start: "2026-10-27" },
    { id: "zz", start: "2026-10-27" },
  ];
  assert.equal(latestStudentSubscription(fixture(items), "student-1")?.id, "zz");
  assert.equal(latestStudentSubscription(fixture(items.reverse()), "student-1")?.id, "zz");
});

test("undated subscriptions do not displace dated subscriptions", () => {
  assert.equal(latestStudentSubscription(fixture([
    { id: "undated" },
    { id: "dated", start: "2026-09-14" },
  ]), "student-1")?.id, "dated");
});

test("Student without a Subscription shows the empty state", () => {
  assert.equal(latestStudentSubscription(fixture([]), "student-1"), null);
});

test("cross-student subscriptions are excluded and lifecycle identity is enforced", () => {
  assert.equal(latestStudentSubscription(fixture([
    { id: "foreign", owner: "student-2", start: "2026-10-27" },
    { id: "owned", start: "2026-09-01" },
  ]), "student-1")?.id, "owned");
  assert.throws(() => latestStudentSubscription(fixture([]), "student-2"), /không khớp/);
});

test("duplicate subscription IDs fail closed", () => {
  assert.throws(() => latestStudentSubscription(fixture([
    { id: "same" }, { id: "same" },
  ]), "student-1"), /trùng/);
});
