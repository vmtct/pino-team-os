import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("Subscription BO uses governed Core reads and explicit commands", async () => {
  const view = await read("app/bo/subscriptions/BoSubscriptionsView.tsx");
  for (const command of ["renewSubscription", "cancelSubscription", "placeEnrollment", "endEnrollment", "activateSubscription", "learnerLifecycle", "subscriptionDirectory"]) {
    assert.ok(view.includes("boApi." + command), "missing " + command);
  }
  assert.ok(view.includes("collectPagedDirectory"));
  assert.ok(!view.includes("Tạo & kích hoạt Subscription"));
  assert.ok(!view.includes("createSubscription(body"));
  assert.ok(view.includes("Core-owned commercial truth"));
  assert.ok(view.includes("placedAtStart !== sub.weeklyCommitment"));
  assert.ok(view.includes('item.pathProgramId === sub.pathProgramId'));
  assert.ok(view.includes("expectedVersion: subscription.version"));
  assert.ok(view.includes("expectedVersion: enrollment.version"));
  assert.ok(view.includes("Core cadence + calendar"));
  assert.ok(!/effectiveAvailableUnits\s*[-+]=/.test(view));
});

test("New sale is deferred and separately preserves contractual end", async () => {
  const [billing,api] = await Promise.all([
    read("app/bo/subscriptions/BillingWorkspace.tsx"), read("lib/bo-api.ts"),
  ]);
  assert.ok(billing.includes("deferActivation: true"));
  assert.ok(billing.includes("contractualEndsOn: contractEndsOn || null"));
  assert.ok(billing.includes("Contract ends (optional)"));
  assert.ok(api.includes("activateSubscription:"));
  assert.ok(api.includes("deferActivation?: boolean"));
  assert.ok(billing.includes("path.id === current") || billing.includes("path.status ==="));
});

test("History Grid uses authenticated directory, Path filters, pagination and Student links", async () => {
  const [view,api] = await Promise.all([read("app/bo/subscriptions/BoSubscriptionsView.tsx"),read("lib/bo-api.ts")]);
  for (const token of ["Subscription history", "historyTable", "nextGridPage", "previousGridPage", "gridPath", "subscriptionDirectory"]) assert.ok(view.includes(token));
  assert.ok(api.includes("subscriptionDirectory:"));
  assert.ok(!view.includes("fetch("));
});

test("Commercial registration preserves replay and cancellation date", async () => {
  const view = await read("app/bo/subscriptions/BoSubscriptionsView.tsx");
  const billing = await read("app/bo/subscriptions/BillingWorkspace.tsx");
  assert.ok(view.includes("pendingAttempt"));
  assert.ok(view.includes("idempotencyKey"));
  assert.ok(view.includes("effectiveUntilExclusiveLocalDate: until.trim()"));
  assert.ok(billing.includes("setPending"));
  assert.ok(billing.includes("runReplay"));
});

test("BO route and Student 360 link remain reachable", async () => {
  const [navigation, learners, host] = await Promise.all([
    read("app/bo/navigation.ts"),read("app/bo/learners/BoLearnersView.tsx"),read("lib/host-boundary.ts"),
  ]);
  assert.ok(navigation.includes('href: "/bo/subscriptions"'));
  assert.ok(learners.includes("/bo/subscriptions?studentId="));
  assert.ok(host.includes('"/bo/subscriptions"'));
});
