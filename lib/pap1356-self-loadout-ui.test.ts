import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {composeTabs} from "./workspace-schema/registry";
import {selfSchema,verifySelfWardrobeApproval} from "../app/bo/pinoria-avatars/schema";
import {decideHostBoundary} from "./host-boundary";

const ui=readFileSync(new URL("../app/bo/pinoria-avatars/SelfLoadoutDetail.tsx",import.meta.url),"utf8");
const preview=readFileSync(new URL("../app/components/pinoria/SelfLoadoutPreview.tsx",import.meta.url),"utf8");
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
test("PAP-1356 BO Loadout + private media exact host/verbs; foreign host denied",()=>{
  for(const method of ["GET","POST"])assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),{action:"next"});
  for(const host of ["bo.pinohouse.art","tos.staging.pinohouse.art","ho.staging.pinohouse.art","evil.example"])
    assert.deepEqual(decideHostBoundary(host,path,"GET"),{action:"not_found"});
  for(const method of ["DELETE","PATCH","PUT","HEAD"])
    assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),{action:"not_found"});
  const media=path+"/media/HAIR";
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",media,"GET"),{action:"next"});
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",media,"POST"),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",media,"GET"),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path+"/media","GET"),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path+"/media/ANY","GET"),{action:"not_found"});
});
test("PAP-1356 Core gateway dispatch before generic Self Item catch-all",()=>{
  assert.equal((route.match(/if \(isBoSelfLoadoutPath\(joined\)\)/g)??[]).length,5);
  assert.ok(route.indexOf("if (isBoSelfLoadoutPath(joined))")<route.indexOf("if (isBoSelfItemPath(joined))"));
});
test("PAP-1356/PAP-1810 native Avatar Loadout uses Core grants and owner-fenced PINO DS",()=>{
  // PAP-1810 retired this route's TDD admission; verify live native DSA + Core grants instead.
  assert.equal(admission.modules.some((m:{key:string})=>m.key==="pinoria-avatars"),false);
  const nativePage=readFileSync(new URL("../app/bo/pinoria-avatars/page.tsx",import.meta.url),"utf8");
  const native=readFileSync(new URL("../app/bo/pinoria-avatars/AvatarDirectoryDsa.tsx",import.meta.url),"utf8");
  assert.match(nativePage,/<AvatarDirectoryDsa\s*\/>/);
  assert.match(native,/<SelfLoadoutDetail/);
  assert.match(native,/canView=\{grants\.has\("pinoria\.self\.loadout\.view"\)\}/);
  assert.match(native,/canManage=\{grants\.has\("pinoria\.self\.loadout\.manage"\)\}/);
  assert.match(native,/canViewItems=\{grants\.has\("pinoria\.self\.item\.view"\)\}/);
  assert.match(native,/centerId=\{centerId\}/);
  assert.doesNotMatch(nativePage+native,/SelfDirectoryTdd|createBoTddAdapter|SurfaceWorkspace/);
  // PAP-1490/1489/1710 owner-fenced business CSS remains in its approved modules.
  const wardrobeCss=readFileSync(new URL("../app/bo/pinoria-avatars/SelfWardrobeDetail.module.css",import.meta.url),"utf8");
  const previewCss=readFileSync(new URL("../app/components/pinoria/SelfLoadoutPreview.module.css",import.meta.url),"utf8");
  const createCss=readFileSync(new URL("../app/bo/pinoria-avatars/CreateAvatarDrawer.module.css",import.meta.url),"utf8");
  assert.match(wardrobeCss,/\.items\s*\{/);
  assert.match(previewCss,/\.canvas\s*\{/);
  for(const name of ["body","picker","options","optionCopy"])
    assert.match(createCss,new RegExp("\\."+name+"\\s*\\{"));
  assert.match(ui,/SelfLoadoutEditorLayout/);
  assert.match(preview,/className="pds-properties"/);
  assert.match(preview,/className="pds-property-grid"/);
  assert.doesNotMatch(ui,/\.module\.css|style=\{\{|className=\{/);
  // PAP-1489 adds a feature canvas size constraint without changing DS layout.
  assert.match(preview,/import styles from "\.\/SelfLoadoutPreview\.module\.css"/);
  assert.doesNotMatch(preview,/style=\{\{/);
});
test("PAP-1356 eight slots, S6 separate, Core CAS and canonical 9:16 compositing",()=>{
  for(const value of ["AURA_GROUND","AURA_BACK","BACK","OUTFIT","HAIR","FACE","HEADWEAR","PATH_MARK","expectedVersion","itemIdsBySlot","idempotency-key"])
    assert.ok(ui.includes(value),value);
  assert.match(ui,/id="self-loadout-set"/);
  assert.match(ui,/value=\{selectedSetId\}/);
  assert.match(ui,/eligibleSets\.map/);
  assert.match(ui,/async function applySet\(\)/);
  assert.match(ui,/selfSet && !selfSet.setItemId\?loadout:null/);
  assert.match(ui,/expectedSelfVersion:selfSet.selfVersion/);
  assert.doesNotMatch(ui,/S6 — chưa bật quản lý Set/);
  assert.match(ui,/canViewItems/);
  assert.match(ui,/loadout\/media\/"\+slot/);
  assert.match(preview,/renderStack/);
  assert.match(preview,/new Image\(\)/);
  assert.match(preview,/ctx\.drawImage/);
  assert.match(preview,/WIDTH=270, HEIGHT=480/);
  assert.match(preview,/char-base\.png/);
  assert.match(preview,/loadout\.renderStack/);
  assert.match(preview,/new URL\(url,window\.location\.href\)\.origin!==window\.location\.origin/);
  assert.doesNotMatch(ui,/pinoria_character_loadouts|localStorage|sessionStorage|\bmock\w*\b/i);
  assert.ok(!preview.includes("r2://"));
  assert.doesNotMatch(preview,/localStorage|sessionStorage/);
});
