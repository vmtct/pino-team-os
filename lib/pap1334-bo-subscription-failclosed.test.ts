import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../app/bo/components/registration/BoRuntimeBoundary.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/bo/components/registration/BoRegistrationWorkspace.tsx", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
const legacy = readFileSync(new URL("../app/bo/subscriptions/BoSubscriptionsView.tsx", import.meta.url), "utf8");

test("PAP-1334 (PAP-1316): legacy Subscription UI is never mounted in active BO query route", () => {
  assert.match(runtime, /if \(moduleKey === "subscriptions"\) return <BoRegistrationWorkspace/);
  assert.match(runtime, /data-testid="bo-subscription-center-contract-pending"/);
  assert.doesNotMatch(runtime, /<BoSubscriptionsView\b/);
  assert.doesNotMatch(runtime, /import \{ BoSubscriptionsView \}/);
});

test("PAP-1334: mounted hold content prevents generic unscoped Subscription fetch", () => {
  assert.match(workspace, /if \(content\) \{ document\.title = definition\.label[\s\S]*?return; \}/);
  assert.match(runtime, /moduleKey="subscriptions" options=\{options\}[\s\S]*?content=\{<section role="status"/);
  assert.match(middleware, /request\.nextUrl\.pathname === "\/bo\/subscriptions"/);
});

test("PAP-1334: old source retained for audit, not called by active BO runtime", () => {
  assert.match(legacy, /renewSubscription\(/);
  assert.match(legacy, /endEnrollment\(/);
  assert.match(runtime, /PAP-1100 v1\.9/);
});
