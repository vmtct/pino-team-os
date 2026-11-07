import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {boCenterModuleScope} from "../app/bo/components/registration/BoGlobalCenterPolicy";
import {isBoStagingRouteAdmitted} from "../app/bo/architecture/bo-staging-route-policy";

const full=readFileSync(new URL("../app/bo/components/registration/BoFullDetail.tsx",import.meta.url),"utf8");
const shell=readFileSync(new URL("../app/bo/components/registration/BoRegistrationWorkspace.tsx",import.meta.url),"utf8");
const entry=readFileSync(new URL("../app/bo/components/registration/BoRuntimeBoundary.tsx",import.meta.url),"utf8");
const tab=readFileSync(new URL("../app/bo/learners/StudentSpecialtyTab.tsx",import.meta.url),"utf8");

test("PAP-1496: canonical /bo Students mounts Specialty between overview and History",()=>{
  assert.match(full,/\["Detail", "Subscription", "Chuyên đề", "Lịch Sử"\]/);
  assert.match(full,/activeTab === "Chuyên đề" && moduleKey === "students" && enableStudentSubscriptions/);
  assert.match(full,/BoStudentSpecialtyTab = lazy\(async \(\) =>/);
  assert.match(full,/import\("@\/app\/bo\/learners\/StudentSpecialtyTab"\)/);
  assert.match(shell,/enableStudentSubscriptions=\{!ho && moduleKey === "students"\}/);
  assert.match(entry,/moduleKey === "students"|moduleKey=\{moduleKey\}/);
});

test("PAP-1496: Specialty is strictly read-only pending actual Core Center grant reader",()=>{
  assert.match(full,/<BoStudentSpecialtyTab items=\{undefined\} currentCenterLocalDate="" readOnly \/>/);
  assert.doesNotMatch(full,/onGrant=|submitStudentSpecialtyGrant|specialtyPurchases/);
  assert.match(tab,/validateBoStudentSpecialtyList\(items\)/);
  assert.match(tab,/if\(readOnly\|\|!onGrant/);
  assert.equal(boCenterModuleScope("students"),"CENTER");
});

test("PAP-1496: no accidental legacy /bo/learners staging route admission or new TDD shell",()=>{
  assert.equal(isBoStagingRouteAdmitted("/bo/learners"),false);
  assert.match(full,/className="v24-prop-grid"/);
  assert.match(full,/<DetailFrame /);
  assert.doesNotMatch(full,/iframe|window\.open|hardcodedFixture/);
});
