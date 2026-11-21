import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const tab=readFileSync(new URL("../app/components/mytime-workshop/WorkshopParticipationTab.tsx",import.meta.url),"utf8");
const schema=readFileSync(new URL("../app/components/mytime-workshop/ParticipationSchema.ts",import.meta.url),"utf8");
const directory=readFileSync(new URL("../app/components/mytime-workshop/ParticipationTdd.tsx",import.meta.url),"utf8");
test("PAP-2242 Participation uses native DSA table and the four audit columns",()=>{
  for(const field of ["Person","Workshop","Trạng thái","Nhóm","Lượt sử dụng","Created Time","Created By","Last Modified Time","Last Modified By"])assert.ok(schema.includes(field));
  assert.ok(tab.includes("<TddTable"));
  assert.ok(tab.includes("<DrawerFrame"));
  assert.ok(directory.includes("<TddRenderer"));
});
test("PAP-2242 nested Create is only a non-persisting M1 shell",()=>{
  assert.ok(tab.includes("canCreate?"));
  assert.ok(tab.includes("people={[]}"));
  assert.ok(tab.includes('disabled aria-disabled="true"'));
  assert.ok(tab.includes("Core read chưa được kết nối"));
  assert.ok(!tab.includes("onCreate={"));
  assert.ok(!tab.includes("fetch("));
});
test("PAP-2242 standalone Participation has no create action and scopes BO to selected Center",()=>{
  assert.ok(directory.includes("useBoCenterSelection"));
  assert.ok(directory.includes("surface=\"BO\" centerId={id}"));
  assert.ok(directory.includes("surface=\"HO\""));
  assert.ok(directory.includes("context.authorize(cap)"));
  assert.ok(!directory.includes("Thêm Participation"));
});
