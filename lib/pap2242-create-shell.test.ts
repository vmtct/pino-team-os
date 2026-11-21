import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const create=readFileSync(new URL("../app/components/mytime-workshop/WorkshopParticipationCreate.tsx",import.meta.url),"utf8");
const tab=readFileSync(new URL("../app/components/mytime-workshop/WorkshopParticipationTab.tsx",import.meta.url),"utf8");
test("PAP-2242 nested M1 shell inherits canonical Workshop and Center",()=>{
  for(const key of ["workshopId","centerId","personId"])assert.ok(create.includes(key));
  assert.ok(create.includes("data-workshop-id={workshopId}"));
  assert.ok(create.includes("data-center-id={centerId}"));
  assert.ok(create.includes("ParticipationPersonPicker"));
});
test("PAP-2242 M1 does not persist Participation before Gate1",()=>{
  assert.ok(!create.includes("onSubmit"));
  assert.ok(!create.includes("fetch("));
  assert.ok(tab.includes("people={[]}"));
  assert.ok(tab.includes('disabled aria-disabled="true"'));
  assert.ok(tab.includes("onClose={()=>setCreateOpen(false)}"));
});
