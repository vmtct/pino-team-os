import test from "node:test";
import assert from "node:assert/strict";
import { BO_TIMEKEEPING_MAX_OFFSET, loadBoTimekeepingPageForState } from "./bo-timekeeping-page-controller";

test("PAP-408 reconciles oversized URL pages before issuing an invalid Core offset", async () => {
  const offsets: number[] = [];
  const load = async ({ offset }: { offset: number }) => {
    offsets.push(offset);
    return { data: offset === 0 ? [{ id: "tk-1" }] : [], summary: { totalSessions: 1 } };
  };

  const oversized = await loadBoTimekeepingPageForState({ page: 40_002, pageSize: 25, query: { centerId: "center-1" }, load });
  assert.deepEqual(oversized, { kind: "reconcile-page", page: 40_001 });
  assert.deepEqual(offsets, []);

  const bounded = await loadBoTimekeepingPageForState({ page: 40_001, pageSize: 25, query: { centerId: "center-1" }, load });
  assert.deepEqual(bounded, { kind: "reconcile-page", page: 1 });
  assert.deepEqual(offsets, [BO_TIMEKEEPING_MAX_OFFSET]);

  const ready = await loadBoTimekeepingPageForState({ page: 1, pageSize: 25, query: { centerId: "center-1" }, load });
  assert.equal(ready.kind, "ready");
  assert.deepEqual(offsets, [BO_TIMEKEEPING_MAX_OFFSET, 0]);
});
