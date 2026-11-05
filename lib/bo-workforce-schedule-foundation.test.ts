import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const calendar=readFileSync(new URL("../app/bo/components/workforce/BoWorkforceWeekPlanner.tsx",import.meta.url),"utf8");
const source=readFileSync(new URL("../app/bo/workforce/WorkforcePlanningView.tsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../app/bo/bo.module.css",import.meta.url),"utf8");

test("PAP-394 keeps the Workforce schedule specialized while adopting BO Foundation V1 language",()=>{
  assert.match(source,/PINO TEAM · BACK OFFICE/);
  assert.match(source,/plannerToolbar/);
  assert.match(source,/Weekly schedule view controls/);
  assert.match(source,/BoDataGridState/);
  assert.match(source,/BoDataGridStatus/);
  assert.match(calendar,/Weekly Workforce planning matrix/);
  assert.match(calendar,/aria-pressed=\{selected\}/);
  assert.match(calendar,/aria-controls="workforce-planner-detail"/);
  assert.match(calendar,/aria-live="polite"/);
  assert.doesNotMatch(source,/<BoDataGrid\s/);
  assert.match(styles,/\.plannerCell:focus-visible/);
  assert.match(styles,/\.plannerToolbar/);
});

test("PAP-394 does not move canonical Workforce scheduling authority into presentation",()=>{
  for(const authority of ["workforcePlanning(","planOperationalWorkforceShift(","cancelWorkforceAssignment(","assignWorkforceShift(","publishWorkforcePlanning(","reopenWorkforcePlanning("]) assert.match(source,new RegExp(authority.replace(/[()]/g,"\\$&")));
  assert.match(source,/expectedVersion:current\.controlVersion/);
  assert.match(source,/crypto\.randomUUID\(\)/);
});
