import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** PAP-1496 / SPEC-UNLOCK: route order must not suppress the real Core student ACL. */
const list = readFileSync(new URL("../app/bo/learners/BoLearnersView.tsx",import.meta.url),"utf8");
const detail = readFileSync(new URL("../app/bo/learners/StudentFullDetail.tsx",import.meta.url),"utf8");

test("PAP-1496: direct Student Full Detail is not gated by unrelated BO scope catalog loading/errors",()=>{
  const entry='if (fullDetailId) return <StudentFullDetail';
  const loading='if (catalog.state === "loading") return';
  const error='if (catalog.state === "error") return';
  for(const token of [entry,loading,error])assert.ok(list.includes(token),token);
  assert.ok(list.indexOf(entry)<list.indexOf(loading));
  assert.ok(list.indexOf(entry)<list.indexOf(error));
  assert.match(list,/key=\{\x60\$\{fullDetailId\}:\$\{activeCenter\}\x60\}/);
  assert.match(list,/useBoCenterSelection/);
});

test("PAP-1496: direct Student read remains scoped to selected Center and Student ID",()=>{
  assert.match(detail,/studentCenterApi\.learnerLifecycle\(studentId, selectedCenter\)/);
  assert.match(detail,/data\.student\.id !== studentId/);
  assert.match(detail,/detail\.scope !== scope/);
  assert.match(detail,/centerReady/);
  assert.match(detail,/center\?\.centers\.some\(entry => entry\.id === selectedCenter\)/);
  assert.match(detail,/<StudentSpecialtyTab[^>]*items=\{undefined\}[^>]*readOnly/);
  assert.doesNotMatch(detail,/student-specialty-grants|specialty\/purchases/);
});

test("PAP-1496: entry route remains the existing BO learners page, not a duplicate prototype",()=>{
  const page=readFileSync(new URL("../app/bo/learners/page.tsx",import.meta.url),"utf8");
  assert.match(page,/BoLearnersView/);
  assert.doesNotMatch(page,/redirect\(|mock|fixture|fake/i);
});
