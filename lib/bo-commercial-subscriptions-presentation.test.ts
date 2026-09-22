import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("Subscriptions owner surface composes canonical commercial facades only", async () => {
  const view = await read("app/bo/subscriptions/BoSubscriptionsView.tsx");
  for (const command of ["createSubscription", "renewSubscription", "cancelSubscription", "placeEnrollment", "endEnrollment"]) {
    assert.match(view, new RegExp(`boApi\\.${command}`));
  }
  assert.match(view, /boApi\.learnerLifecycle/);
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
  assert.match(view, /convenience defaults/);
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
  assert.doesNotMatch(view, /fetch\(/);
});
