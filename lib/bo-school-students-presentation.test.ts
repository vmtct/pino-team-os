import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(path, "utf8");

test("School Students uses canonical private facades and never ships the review snapshot", async () => {
  const [view, api] = await Promise.all([
    read("app/bo/learners/BoLearnersView.tsx"),
    read("lib/bo-api.ts"),
  ]);
  assert.match(view, /boApi\.learners\("", 200\)/);
  assert.match(view, /boApi\.learnerLifecycle/);
  assert.match(view, /boApi\.scopeCatalog/);
  assert.doesNotMatch(view, /student-snapshot|Production D1 snapshot|school-students-review/);
  assert.match(api, /learners\?limit=/);
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
