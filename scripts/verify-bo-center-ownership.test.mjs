import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { boCenterOwnershipViolations } from "./verify-bo-center-ownership.mjs";

const SHELL="app/bo/components/registration/BoRuntimeBoundary.tsx";
const SELF="app/bo/pinoria-avatars/SelfDirectoryTdd.tsx";
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),"pap1459-bo-center-"));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const write=(path,content)=>{
    const abs=join(root,path);mkdirSync(dirname(abs),{recursive:true});writeFileSync(abs,content);
  };
  write(SHELL, 'return <BoCenterSelectionProvider>{children}</BoCenterSelectionProvider>');
  write(SELF, 'const center=useBoCenterSelection(); const selected=center.selected; const current=ready?.centerId===selected?ready:null; return <SurfaceWorkspace key={selected} />;');
  return {root,write};
}

test("PAP-1459 positive: one shell picker, consumer hook and legitimate business Center field",t=>{
  const {root,write}=fixture(t);
  write("app/bo/pinoria-avatars/SelfWardrobeDetail.tsx", '<select id="domain-center-field"><option>Center</option></select>');
  assert.deepEqual(boCenterOwnershipViolations(root),[]);
});

test("PAP-1459 negative: duplicate Center provider is rejected",t=>{
  const {root,write}=fixture(t);
  write("app/bo/missions/MissionsTdd.tsx", 'return <BoCenterSelectionProvider>duplicate</BoCenterSelectionProvider>');
  assert.ok(boCenterOwnershipViolations(root).some(x=>x.includes("outside authenticated shell")));
});

test("PAP-1459 negative: module-owned Center candidate discovery is rejected",t=>{
  const {root,write}=fixture(t);
  write(SELF,'loadAuthorizedDirectoryCenters(fetch,signal); const center=useBoCenterSelection(); const selected=center.selected; const current=ready?.centerId===selected?ready:null; return <SurfaceWorkspace key={selected} />');
  assert.ok(boCenterOwnershipViolations(root).some(x=>x.includes("module-local Center discovery")));
});

test("PAP-1459 negative: a renamed local TDD workspace picker is rejected",t=>{
  const {root,write}=fixture(t);
  write(SELF,'const center=useBoCenterSelection(); const selected=center.selected; const current=ready?.centerId===selected?ready:null; createBoTddAdapter({centerId:selected}); return <><select id="other-center">x</select><SurfaceWorkspace key={selected}/></>');
  assert.ok(boCenterOwnershipViolations(root).some(x=>x.includes("embeds a workspace Center picker")));
});

test("PAP-1460 bounded legacy: exact existing picker accepted as tracked debt, new picker denied",t=>{
  const {root,write}=fixture(t);
  const legacy="app/bo/missions/BoMissionsTdd.tsx";
  write(legacy,'createBoTddAdapter({}); return <select id="bo-mission-center">legacy</select>');
  assert.deepEqual(boCenterOwnershipViolations(root),[]);
  write(legacy,'createBoTddAdapter({}); return <><select id="bo-mission-center"/><select id="other-center"/></>');
  assert.ok(boCenterOwnershipViolations(root).some(x=>x.includes("PAP-1460 picker baseline changed")));
});

test("PAP-1459 negative: stale adapter or local state undermines switch safety",t=>{
  const {root,write}=fixture(t);
  write(SELF,'const center=useBoCenterSelection(); const selected=center.selected; setSelected("forged"); return <SurfaceWorkspace key={selected}/>');
  assert.ok(boCenterOwnershipViolations(root).some(x=>x.includes("fence stale adapter")));
});

test("PAP-1460 Diary negative: reintroduced local Center chooser is rejected",t=>{
  const {root,write}=fixture(t);
  write("app/bo/classroom-diaries/BoClassroomDiariesTdd.tsx",
    'const center=useBoCenterSelection();const selected=center.selected;createBoTddAdapter({centerId:selected});return <select id="diary-center"/>;');
  assert.ok(boCenterOwnershipViolations(root).some(x=>x.includes("embeds a workspace Center picker")));
});

test("PAP-1460 Diary negative: missing shell consumer/stale adapter fence is rejected",t=>{
  const {root,write}=fixture(t);
  write("app/bo/classroom-diaries/BoClassroomDiariesTdd.tsx",
    'createBoTddAdapter({centerId:"forged"});return <SurfaceWorkspace/>;');
  assert.ok(boCenterOwnershipViolations(root).some(x=>x.includes("migrated Diary must consume shell Center")));
});
test("PAP-1459 actual repository obeys single BO Center owner",()=>{
  assert.deepEqual(boCenterOwnershipViolations(),[]);
});
