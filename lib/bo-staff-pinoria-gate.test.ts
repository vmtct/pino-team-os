import assert from "node:assert/strict";
import test from "node:test";
import { shouldLoadStaffPinoria } from "./bo-staff-pinoria-gate";
import { createStaffPrivateRevealFence } from "./staff-private-reveal-fence";

test("PAP-790 Pinoria read runs only on selected full detail Pinoria tab", () => {
  assert.equal(shouldLoadStaffPinoria(true, "pinoria", "staff-a"), true);
  assert.equal(shouldLoadStaffPinoria(true, "overview", "staff-a"), false);
  assert.equal(shouldLoadStaffPinoria(false, "pinoria", "staff-a"), false);
  assert.equal(shouldLoadStaffPinoria(true, "pinoria", ""), false);
});

test("PAP-790 target/tab changes invalidate stale Pinoria read", () => {
  const fence = createStaffPrivateRevealFence();
  const old = fence.begin();
  fence.invalidate();
  assert.equal(fence.accepts(old), false);
  const next = fence.begin();
  assert.equal(fence.accepts(next), true);
});
