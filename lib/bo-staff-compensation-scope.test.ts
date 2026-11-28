import assert from "node:assert/strict";
import test from "node:test";
import { staffCompensationOnly } from "./bo-staff-compensation-scope";
import { createStaffPrivateRevealFence } from "./staff-private-reveal-fence";

test("PAP-789 excludes compensation belonging to another Staff", () => {
  const rows = [{ staffMemberId: "staff-a", amountMinor: 25000 }, { staffMemberId: "staff-b", amountMinor: 70000 }];
  assert.deepEqual(staffCompensationOnly(rows, "staff-a"), [rows[0]]);
  assert.deepEqual(staffCompensationOnly(rows, "unknown"), []);
});

test("PAP-789 stale compensation response cannot reappear after hide or target switch", () => {
  const guard = createStaffPrivateRevealFence();
  const first = guard.begin();
  assert.equal(guard.accepts(first), true);
  guard.invalidate();
  assert.equal(guard.accepts(first), false);
  const next = guard.begin();
  assert.equal(guard.accepts(next), true);
  assert.equal(guard.accepts(first), false);
});
