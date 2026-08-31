import test from "node:test";
import assert from "node:assert/strict";
import { canManageFounderTarget, hasEffectiveFounderAssignment } from "./bo-access-founder-ui";

const now = Date.parse("2026-08-31T08:40:00Z");

test("effective Founder assignment is required for Founder recovery controls", () => {
  assert.equal(hasEffectiveFounderAssignment([{ roleKey: "founder", roleStatus: "active", effectiveFrom: "2026-08-31T08:00:00Z", effectiveUntil: null }], now), true);
  assert.equal(hasEffectiveFounderAssignment([{ roleKey: "founder", roleStatus: "archived", effectiveFrom: "2026-08-31T08:00:00Z", effectiveUntil: null }], now), false);
  assert.equal(hasEffectiveFounderAssignment([{ roleKey: "founder", roleStatus: "active", effectiveFrom: "2026-08-31T09:00:00Z", effectiveUntil: null }], now), false);
  assert.equal(hasEffectiveFounderAssignment([{ roleKey: "founder", roleStatus: "active", effectiveFrom: "2026-08-31T07:00:00Z", effectiveUntil: "2026-08-31T08:30:00Z" }], now), false);
});

test("Founder recovery controls never allow self-management", () => {
  assert.equal(canManageFounderTarget("actor", "other", true), true);
  assert.equal(canManageFounderTarget("actor", "actor", true), false);
  assert.equal(canManageFounderTarget("actor", "other", false), false);
});
