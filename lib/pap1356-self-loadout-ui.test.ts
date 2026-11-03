import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {composeTabs} from "./workspace-schema/registry";
import {selfSchema,verifySelfWardrobeApproval} from "../app/bo/pinoria-avatars/schema";
import {decideHostBoundary} from "./host-boundary";
const view=readFileSync(new URL("../app/bo/pinoria-avatars/SelfDirectoryTdd.tsx",import.meta.url),"utf8");
const ui=readFileSync(new URL("../app/bo/pinoria-avatars/SelfLoadoutDetail.tsx",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/bo/[...path]/route.ts",import.meta.url),"utf8");
const admission=JSON.parse(readFileSync(new URL("../config/tdd-admission.json",import.meta.url),"utf8"));
const selfId="01a18140-10b8-70d3-ad6b-3e747a0cddea";
const path="/api/bo/pinoria/selfs/"+selfId+"/loadout";

test("PAP-1356 approved TDD: overview/wardrobe/loadout/history",()=>{
  assert.deepEqual(composeTabs(selfSchema).map(t=>t.id),["overview","wardrobe","loadout","history"]);
  const approved=selfSchema.detail.businessTabs[1];
  assert.equal(approved?.kind,"approved-extension");
  if(approved?.kind!=="approved-extension")return;
  assert.equal(approved.source.permission,"pinoria.self.loadout.view");
  assert.equal(verifySelfWardrobeApproval(approved.approval,{surface:"BO",key:"pinoria-avatars",extensionId:approved.extensionId}),true);
  assert.equal(verifySelfWardrobeApproval(approved.approval,{surface:"HO",key:"pinoria-avatars",extensionId:approved.extensionId}),false);
});
test("PAP-1356 BO host only exact GET/POST and wrong host/verb fail 404",()=>{
  for(const method of ["GET","POST"])assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),{action:"next"});
  for(const host of ["bo.pinohouse.art","tos.staging.pinohouse.art","ho.staging.pinohouse.art","evil.example"])assert.deepEqual(decideHostBoundary(host,path,"GET"),{action:"not_found"});
  for(const method of ["DELETE","PATCH","PUT","HEAD"])assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path+"/media","GET"),{action:"not_found"});
});
test("PAP-1356 Core gateway dispatches before generic Self Item catch-all",()=>{
  assert.equal((route.match(/if \(isBoSelfLoadoutPath\(joined\)\)/g)??[]).length,5);
  assert.ok(route.indexOf("if (isBoSelfLoadoutPath(joined))")<route.indexOf("if (isBoSelfItemPath(joined))"));
});
test("PAP-1356 tabs and DS admission reference bounded new business extension",()=>{
  const entry=admission.modules.find((m:{key:string})=>m.key==="pinoria-avatars");
  assert.ok(entry.files.includes("app/bo/pinoria-avatars/SelfLoadoutDetail.tsx"));
  assert.ok(entry.tests.includes("lib/pap1356-self-loadout-ui.test.ts"));
  assert.match(view,/activeTab === "loadout"/);
  assert.match(view,/context\.authorize\("pinoria\.self\.loadout\.view"\)/);
  assert.match(view,/context\.authorize\("pinoria\.self\.loadout\.manage"\)/);
});
test("PAP-1356 full eight slots, separate SET, canonical CAS & truthful missing private media",()=>{
  for(const text of ["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK","expectedVersion","itemIdsBySlot","idempotency-key","PAP-1428"])assert.ok(ui.includes(text),text);
  assert.match(ui,/S6 — chưa bật quản lý Set/);
  assert.match(ui,/canViewItems/);
  assert.doesNotMatch(ui,/pinoria_character_loadouts|localStorage|sessionStorage|style=\{\{|\bmock\w*\b/i);
});
