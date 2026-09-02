import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("School Students uses complete paged canonical reads and never ships the review snapshot", async () => {
  const [view, api] = await Promise.all([
    read("app/bo/learners/BoLearnersView.tsx"),
    read("lib/bo-api.ts"),
  ]);
  assert.match(view, /collectPagedDirectory/);
  assert.match(view, /boApi\.learners\("", limit, offset\)/);
  assert.match(view, /boApi\.learnerLifecycle/);
  assert.match(view, /boApi\.scopeCatalog/);
  assert.doesNotMatch(view, /student-snapshot|Production D1 snapshot|school-students-review/);
  assert.match(api, /learners\?limit=/);
  assert.match(api, /offset=/);
});

test("School Students delegates placement and transfer to owner commands", async () => {
  const [view, api] = await Promise.all([
    read("app/bo/learners/BoLearnersView.tsx"),
    read("lib/bo-api.ts"),
  ]);
  assert.match(view, /boApi\.placeEnrollment/);
  assert.match(view, /boApi\.transferEnrollment/);
  assert.doesNotMatch(view, /endEnrollment[\s\S]{0,300}placeEnrollment/);
  assert.match(api, /enrollments\/\$\{encodeURIComponent\(enrollmentId\)\}\/transfer/);
});

test("School Students binds targets, current Student and replay context explicitly", async () => {
  const [view, api] = await Promise.all([
    read("app/bo/learners/BoLearnersView.tsx"),
    read("lib/bo-api.ts"),
  ]);
  assert.match(view, /kind: "renew", subscriptionId: subscription\.id/);
  assert.match(view, /kind: "place", subscriptionId: subscription\.id/);
  assert.match(view, /kind: "transfer", enrollmentId: current\[0\]!\.id/);
  assert.match(view, /LatestRequestFence/);
  assert.match(view, /selectedIdRef/);
  assert.match(view, /window\.sessionStorage/);
  assert.match(view, /replayContext/);
  assert.match(view, /result\.replayed \|\| !result\.temporaryPin/);
  assert.match(view, /PIN tạm chỉ hiển thị một lần/);
  assert.match(api, /temporaryPin: string \| null/);
  assert.doesNotMatch(api, /createSubscription:[^\n]*crypto\.randomUUID/);
  assert.doesNotMatch(api, /renewSubscription:[^\n]*crypto\.randomUUID/);
  assert.doesNotMatch(api, /placeEnrollment:[^\n]*crypto\.randomUUID/);
  assert.doesNotMatch(api, /transferEnrollment:[^\n]*crypto\.randomUUID/);
});
