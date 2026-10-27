import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

test("PAP-1064 Workforce uses the October-27 approved BO CSS authority", async () => {
  const manifest = JSON.parse(await readFile("public/bo-authority-source/CSS_AUTHORITY.json", "utf8")) as {
    files: Array<{file: string; sha256: string}>;
  };
  const stylesheet = await readFile("public/bo-authority-source/styles.css");
  const file = manifest.files.find(entry => entry.file === "styles.css");
  assert.ok(file);
  assert.equal(createHash("sha256").update(stylesheet).digest("hex").toLowerCase(), file.sha256.toLowerCase());
});

test("PAP-1064 Center-scoped GLOBAL weeks and the canonical BO detail stay in sync", async () => {
  const [planner, adapter, registry, detail, css] = await Promise.all([
    readFile("app/bo/workforce/WorkforcePlanningView.tsx", "utf8"),
    readFile("app/bo/architecture/workforce-read-adapters.ts", "utf8"),
    readFile("app/bo/architecture/registry.ts", "utf8"),
    readFile("app/bo/components/registration/BoFullDetail.tsx", "utf8"),
    readFile("app/bo/bo.module.css", "utf8"),
  ]);
  assert.match(planner, /workforceRead\.globalWeeks\(centerId\)/);
  assert.doesNotMatch(planner, /termById\.get\(week\.termId\)\?\.centerId/);
  assert.match(planner, /submittedStaff/);
  assert.match(planner, /plannerSearchBar/);
  assert.match(adapter, /display\.weekName\(s\.centerId, s\.termWeekId\)/);
  assert.match(registry, /key: "centerName", label: "Center"/);
  assert.match(registry, /key: "termWeekLabel", label: "Tuần"/);
  assert.match(detail, /BoWorkforcePlannerTab embedded scope=/);
  assert.match(css, /@container \(max-width: 900px\)/);
  assert.doesNotMatch(css, /@container \(max-width: 1060px\)/);
  assert.doesNotMatch(css, /@media \(max-width: 1440px\) \{ \.plannerLayout/);
});