import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isOperationalReadPath } from "./bo-read-handler";
import { BO_HOSTNAME, decideHostBoundary } from "./host-boundary";

const read = (path: string) => readFile(path, "utf8");

test("Subscriptions owner surface composes canonical commercial facades only", async () => {
  const view = await read("app/bo/subscriptions/BoSubscriptionsView.tsx");
  for (const command of ["createSubscription", "renewSubscription", "cancelSubscription", "placeEnrollment", "endEnrollment"]) {
    assert.match(view, new RegExp(`boApi\\.${command}`));
  }
  assert.match(view, /boApi\.learnerLifecycle/);
  assert.match(view, /boApi\.subscriptionProjectedCompletion/);
  assert.match(view, /boApi\.scopeCatalog/);
  assert.match(view, /collectPagedDirectory/);
  assert.doesNotMatch(view, /serviceUnit.*(?:--|-=)|effectiveAvailableUnits\s*[-+]=|set.*effectiveAvailableUnits/i);
});

test("Subscriptions owner surface keeps Core policy and scope authoritative", async () => {
  const view = await read("app/bo/subscriptions/BoSubscriptionsView.tsx");
  assert.match(view, /item\.status === "ACTIVE" && item\.pathProgramId === sub\.pathProgramId/);
  assert.match(view, /commandEffectiveLocalDate: today\(\)/);
  assert.match(view, /policyEffectiveAt: new Date\(\)\.toISOString\(\)/);
  assert.match(view, /expectedVersion: subscription\.version/);
  assert.match(view, /expectedVersion: enrollment\.version/);
  assert.match(view, /Repair path legacy/);
  assert.match(view, /Manual repair only/);
  assert.match(view, /Contract ends/);
  assert.match(view, /Forecast ends/);
  assert.match(view, /contractualEndsOn/);
  assert.match(view, /Core cadence \+ calendar/);
  assert.doesNotMatch(view, /effectiveAvailableUnits\s*\/\s*subscription\.weeklyCommitment|weeksLeft/);
  assert.doesNotMatch(view, /price|invoice|discount|refund/i);
});

test("School navigation and Student 360 link to the Subscription owner surface", async () => {
  const [navigation, learners, host] = await Promise.all([
    read("app/bo/navigation.ts"),
    read("app/bo/learners/BoLearnersView.tsx"),
    read("lib/host-boundary.ts"),
  ]);
  assert.match(navigation, /href: "\/bo\/subscriptions", label: "Subscriptions"/);
  assert.match(learners, /\/bo\/subscriptions\?studentId=/);
  assert.match(host, /"\/bo\/subscriptions"/);
});

test("Subscriptions page remains presentation-only and uses existing API contracts", async () => {
  const [page, view, api] = await Promise.all([
    read("app/bo/subscriptions/page.tsx"),
    read("app/bo/subscriptions/BoSubscriptionsView.tsx"),
    read("lib/bo-api.ts"),
  ]);
  assert.match(page, /BoSubscriptionsView/);
  assert.match(api, /createSubscription:/);
  assert.match(api, /renewSubscription:/);
  assert.match(api, /placeEnrollment:/);
  assert.match(api, /subscriptionProjectedCompletion:/);
  assert.match(api, /contractualEndsOn: string/);
  assert.doesNotMatch(view, /fetch\(/);
});


test("Commercial commands preserve exact replay evidence across uncertain outcomes", async () => {
  const [view, api] = await Promise.all([read("app/bo/subscriptions/BoSubscriptionsView.tsx"), read("lib/bo-api.ts")]);
  assert.match(view, /type CommandAttempt/);
  assert.match(view, /idempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(view, /pendingAttempt\.key === key/);
  assert.match(view, /attempt\.action\(attempt\.idempotencyKey\)/);
  assert.match(view, /definitiveRejection = error instanceof BoApiError && error\.structuredResponse && error\.status >= 400 && error\.status < 500/);
  assert.match(view, /Thử lại cùng yêu cầu/);
  assert.match(view, /blocked=\{Boolean\(commandState\.busy \|\| pendingAttempt \|\| billingReplay\.busy \|\| billingReplay\.pending\)\}/);
  for (const command of ["createSubscription", "renewSubscription", "cancelSubscription", "placeEnrollment", "endEnrollment"]) {
    assert.match(api, new RegExp(`${command}:[^\n]+idempotencyKey: string`));
  }
  assert.doesNotMatch(api, /(?:createSubscription|renewSubscription|cancelSubscription|placeEnrollment|endEnrollment):[^\n]+crypto\.randomUUID\(\)/);
});



test("Projected completion is admitted through the complete BO read facade", async () => {
  const id = "0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const path = `subscriptions/${id}/projected-completion`;
  assert.equal(isOperationalReadPath(path), true);
  assert.deepEqual(decideHostBoundary(BO_HOSTNAME, `/api/bo/${path}`), { action: "next" });

  const handler = await read("lib/bo-read-handler.ts");
  assert.match(handler, /SUBSCRIPTION_PROJECTED_COMPLETION_READ\.test\(path\)[\s\S]*effectiveAt: url\.searchParams\.get\("effectiveAt"\)/);
});
