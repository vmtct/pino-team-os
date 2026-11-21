import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const tab=readFileSync(new URL("../app/components/mytime-workshop/WorkshopParticipationTab.tsx",import.meta.url),"utf8");
const schema=readFileSync(new URL("../app/components/mytime-workshop/ParticipationSchema.ts",import.meta.url),"utf8");
const directory=readFileSync(new URL("../app/components/mytime-workshop/ParticipationTdd.tsx",import.meta.url),"utf8");
const picker=readFileSync(new URL("../app/components/mytime-workshop/ParticipationPersonPicker.tsx",import.meta.url),"utf8");
const boNavigation=readFileSync(new URL("../app/bo/navigation.ts",import.meta.url),"utf8");
const workshopWorkspace=readFileSync(new URL("../app/components/mytime-workshop/WorkshopWorkspace.tsx",import.meta.url),"utf8");

test("PAP-2242 Participation uses native DSA table and the four audit columns",()=>{
  for(const field of ["Person","Workshop","Trạng thái","Nhóm","Lượt sử dụng","Created Time","Created By","Last Modified Time","Last Modified By"])assert.ok(schema.includes(field));
  assert.ok(tab.includes("<TddTable"));
  assert.ok(tab.includes("<DrawerFrame"));
  assert.ok(directory.includes("<TddRenderer"));
});

test("PAP-2242 nested Create is a non-persisting M1 shell with host-supplied Person candidates",()=>{
  assert.ok(tab.includes("canCreate?"));
  assert.ok(tab.includes("people={personCandidates}"));
  assert.ok(tab.includes('disabled aria-disabled="true"'));
  assert.ok(tab.includes("Core read chưa được kết nối"));
  assert.ok(!tab.includes("fetch("));
  assert.ok(!tab.includes("onCreate={"));
  assert.ok(picker.includes("placeholder=\"Nhập để tìm kiếm người\""));
});

test("PAP-2242 deferred BO Participation route is not exposed from global or Workshop-list navigation",()=>{
  assert.ok(!boNavigation.includes('/bo/mytime-participations'));
  assert.ok(!workshopWorkspace.includes('/bo/mytime-participations'));
});

test("PAP-2242 standalone Participation has no create action and scopes BO to selected Center",()=>{
  assert.ok(directory.includes("useBoCenterSelection"));
  assert.ok(directory.includes("surface=\"BO\" centerId={id}"));
  assert.ok(directory.includes("surface=\"HO\""));
  assert.ok(directory.includes("context.authorize(cap)"));
  assert.ok(!directory.includes("Thêm Participation"));
});
