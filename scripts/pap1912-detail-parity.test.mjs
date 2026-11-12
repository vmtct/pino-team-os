/** PAP-1912 / PAP-1491 — mutation tests prove the CI gate actually fails closed. */
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {ROOT,audit,inspectConsumer,checkSharedFrame,checkImmutableDetailReload} from "./pap1912-detail-parity.mjs";
const read=file=>fs.readFileSync(path.join(ROOT,file),"utf8");
const moduleFile="app/bo/subscriptions/SubscriptionDirectoryDsa.tsx";
const moduleSource=read(moduleFile);
test("PAP-1912 global BO/HO/TOS Detail contract source baseline passes",()=>{
  assert.deepEqual(audit(ROOT),[]);
});
test("PAP-1912 missing tablist or panel in shared DetailFrame always blocks CI",()=>{
  const file="app/components/workspace-renderer/DetailFrame.tsx",s=read(file);
  for(const marker of ['role="tablist"','role="tabpanel"','detail-main','aria-labelledby']){
    assert.notDeepEqual(checkSharedFrame(s.split(marker).join('REMOVED_MARKER')),[],marker);
  }
});
test("PAP-1912 missing registered business tab and CSS wrapper bypass both block",()=>{
  assert.ok(audit(ROOT,{overrides:{[moduleFile]:moduleSource.replace('tabs={subscriptionDetailTabs}','')}}).some(e=>/missing canonical tabs/.test(e)));
  const bypass=moduleSource.replace('tabs={subscriptionDetailTabs}','legacyContent={<p>unsafe</p>}');
  assert.ok(audit(ROOT,{overrides:{[moduleFile]:bypass}}).some(e=>/unapproved legacyContent/.test(e)));
  const missing=moduleSource.replace('{id:"Enrollment",label:"Enrollment"},','');
  assert.ok(audit(ROOT,{overrides:{[moduleFile]:missing}}).some(e=>/business tab IDs\/labels drift/.test(e)));
});
test("PAP-1912 direct URL reload rendering Drawer rather than Full Detail blocks",()=>{
  const prior=moduleSource.replace('setDrawer(null);setDetail({id:item.id,row});',
    'setDetail(null);setDrawer({id:item.id,row});');
  assert.ok(checkImmutableDetailReload(prior).some(e=>/Full Detail/.test(e)));
  assert.ok(audit(ROOT,{overrides:{[moduleFile]:prior}}).some(e=>/Full Detail/.test(e)));
  const noCenter=moduleSource.replace('assertCenterDetail(','unsafeDetail(');
  assert.ok(audit(ROOT,{overrides:{[moduleFile]:noCenter}}).some(e=>/selected Center/.test(e)));
});
test("PAP-1912 unregistered new Detail consumer is blocked even if it looks legitimate",()=>{
  const file="app/bo/new-feature/UnregisteredDetail.tsx";
  const source='<DetailFrame title="Sample" tabs={tabs} selected="info" onSelect={()=>{}}>Detail</DetailFrame>';
  assert.ok(inspectConsumer(file,source,undefined,[]).some(e=>/unregistered/.test(e)));
});
test("PAP-1912 Parent exception cannot authorize new bypass in arbitrary modules",()=>{
  const file="app/ho/new-feature/FakeParentDetail.tsx";
  const source='<DetailFrame legacyContent={<BoParentReadTabs />}>Unsafe</DetailFrame>';
  assert.ok(inspectConsumer(file,source,{file,uses:1,mode:"tabbed",jira:"PAP-1912"},[
    {file:"app/bo/parents/ParentDirectoryDsa.tsx",component:"BoParentReadTabs",jira:"PAP-1384",reason:"legacy"}
  ]).some(e=>/unapproved legacyContent/.test(e)));
});

test("PAP-1912 new consumer registration must specify executable live-G4 scenario",()=>{
  const manifest=JSON.parse(read("config/pap1912-detail-parity.json"));
  manifest.consumers.push({file:"app/bo/new-module/NewFullDetail.tsx",uses:1,mode:"tabbed",jira:"PAP-1912"});
  const failures=audit(ROOT,{manifest});
  assert.ok(failures.some(e=>/new Detail needs executable authorized live-G4 contract/.test(e)));
});
test("PAP-1912 live-G4 is not silently marked PASS without opt-in",async()=>{
  const {spawnSync}=await import("node:child_process");
  const r=spawnSync(process.execPath,["scripts/pap1912-detail-live-cdp.mjs"],{
    cwd:ROOT,encoding:"utf8",env:{...process.env,CI:"1",PAP1912_DETAIL_G4:"0"},timeout:15000
  });
  assert.notEqual(r.status,0);
  assert.match((r.stdout||"")+(r.stderr||""),/PAP1912_LIVE_G4_NOT_AUTHORIZED/);
});
test("PAP-1912 actual TOS runtime paths (tos-v4 and staff) reject future unregistered DetailFrame",()=>{
  const file="app/tos-v4/page.tsx";
  const newSource=read(file)+"\nconst PAP1912FutureTos=()=> <DetailFrame title=\"Test\" tabs={tabs} selected=\"info\" onSelect={()=>{}}>Test</DetailFrame>;";
  const failures=audit(ROOT,{overrides:{[file]:newSource}});
  assert.ok(failures.some(e=>e.includes(file)&&e.includes("unregistered DetailFrame")));
});
test("PAP-1912 ACL live runner uses a real second Center, not a malformed sentinel UUID",()=>{
  const source=read("scripts/pap1912-detail-live-cdp.mjs");
  assert.match(source,/const foreignCenter=c\.data\?\.find\(x=>x\.id!==center\.id\)/);
  assert.match(source,/if\(!foreignCenter\)return \{ok:false,reason:"NO_REAL_FOREIGN_CENTER"\}/);
  assert.match(source,/foreign:await get\(prefix\+"\?centerId="\+encodeURIComponent\(foreignCenter\.id\)\)/);
  assert.doesNotMatch(source,/00000000-0000-4000-8000-000000000001/);
});
