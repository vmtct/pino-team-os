import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {verifyBoRuntimeSurfaceOwnership} from "./verify-bo-runtime-surface-ownership.mjs";
const manifest="app/bo/architecture/bo-runtime-surface-ownership.json";
const ui="app/bo/subscriptions/BoSubscriptionsView.tsx";
const entry="app/bo/components/registration/BoRuntimeBoundary.tsx";
const middleware="middleware.ts";
const get=p=>fs.readFileSync(p,"utf8");
test("PAP-1050 every BO source/registry module must own a deterministic runtime surface",()=>{
 const r=verifyBoRuntimeSurfaceOwnership();
 assert.equal(r.ok,true,r.issues.join("; "));
 assert.ok(r.owned>=14);
});
test("new school module cannot silently fall back to a generic create UI",()=>{
 const m=JSON.parse(get(manifest));delete m.modules.subscriptions;
 const r=verifyBoRuntimeSurfaceOwnership(undefined,{[manifest]:JSON.stringify(m)});
 assert.equal(r.ok,false);assert.match(r.issues.join(","),/Unowned|no UI owner|New module/);
});
test("future source module must declare ownership before CI",()=>{
 const s=get("public/bo-authority-source/school-adapters.js");
 const r=verifyBoRuntimeSurfaceOwnership(undefined,{"public/bo-authority-source/school-adapters.js":s.replace("  subscriptions:{","  futurePilot:{label:'New',fields:[]},\n  subscriptions:{")});
 assert.equal(r.ok,false);assert.match(r.issues.join(","),/futurePilot/);
});
test("PAP-1853 Center-scoped native Subscription DSA is the sole admitted BO runtime owner",()=>{
 const m=JSON.parse(get(manifest)),e=get(entry);
 assert.equal(m.specialized.subscriptions.component,"app/bo/subscriptions/SubscriptionDirectoryDsa.tsx");
 assert.equal(m.specialized.subscriptions.deliveryState,"center-read-only");
 assert.equal(m.specialized.subscriptions.approvalIssue,"PAP-1334");
 assert.equal(m.specialized.subscriptions.guardKeeperIssue,"PAP-1853");
 assert.equal(verifyBoRuntimeSurfaceOwnership().ok,true);
 assert.match(e,/content=\{<SubscriptionDirectoryDsa \/>}/);
 assert.doesNotMatch(e,/<BoSubscriptionsView embedded \/>/);
});

test("PAP-1853 fail closed if native UI marker, Center adapter, or attestation is removed",()=>{
 const native="app/bo/subscriptions/SubscriptionDirectoryDsa.tsx";
 const adapter="lib/pap1334-native-subscription-read.ts";
 const original=get(native),client=get(adapter);
 for(const needle of ['data-bo-runtime-surface="subscription-center-read-only"',
  'data-pap1334-native-subscriptions="read-only"',"assertCenterDetail(","loadCenterSubscriptionDirectory(",
  "readSubscriptionCenterDetail(","BoDataTable","BoQuickView","DetailFrame"]){
  assert.ok(original.includes(needle),needle);
  const out=verifyBoRuntimeSurfaceOwnership(undefined,{[native]:original.replaceAll(needle,"REMOVED")});
  assert.equal(out.ok,false,needle);
 }
 for(const needle of ['"/api/bo/subscriptions/center-directory?"',"item.centerId!==centerId","row.centerId!==centerId"]){
  assert.ok(client.includes(needle),needle);
  assert.equal(verifyBoRuntimeSurfaceOwnership(undefined,{[adapter]:client.replace(needle,"REMOVED")}).ok,false,needle);
 }
});

test("PAP-1853 old Subscription writer cannot remount or spoof approved read-only admission",()=>{
 const entrySource=get(entry),native="app/bo/subscriptions/SubscriptionDirectoryDsa.tsx",old="app/bo/subscriptions/BoSubscriptionsView.tsx";
 const variants=[
  entrySource.replace('content={<SubscriptionDirectoryDsa />}','content={<BoSubscriptionsView embedded />}'),
  entrySource.replace('content={<SubscriptionDirectoryDsa />}','content={<section role="status">hold</section>}'),
  entrySource+'<BoSubscriptionsView embedded />',
 ];
 for(const altered of variants){
  assert.notEqual(altered,entrySource);
  const v=verifyBoRuntimeSurfaceOwnership(undefined,{[entry]:altered});
  assert.ok(v.issues.some(x=>x.includes("only Center-authenticated")),JSON.stringify(v.issues));
 }
 const content=get(native),legacy=get(old);
 assert.ok(verifyBoRuntimeSurfaceOwnership(undefined,{[native]:content+'\\n<SubscriptionCreateDrawer />'}).issues.some(x=>x.includes("unsafe legacy")));
 assert.ok(verifyBoRuntimeSurfaceOwnership(undefined,{[old]:legacy.replace('data-bo-runtime-surface="subscriptions-core"','archive-removed')}).issues.some(x=>x.includes("historical")));
});

test("PAP-1853 exact Founder approval and keeper are necessary for native runtime ownership",()=>{
 const original=JSON.parse(get(manifest));
 for(const [field,value] of [["approvalIssue","PAP-9999"],["guardKeeperIssue",null],
  ["deliveryState","suspended"],["component","app/bo/subscriptions/BoSubscriptionsView.tsx"],
  ["legacyComponent","app/bo/subscriptions/SubscriptionDirectoryDsa.tsx"]]){
  const x=structuredClone(original);x.specialized.subscriptions[field]=value;
  const out=verifyBoRuntimeSurfaceOwnership(undefined,{[manifest]:JSON.stringify(x)});
  assert.equal(out.ok,false,field);
 }
 const withoutState=structuredClone(original);
 delete withoutState.specialized.subscriptions.deliveryState;
 const invalid=verifyBoRuntimeSurfaceOwnership(undefined,{[manifest]:JSON.stringify(withoutState)});
 assert.ok(invalid.issues.some(x=>x.includes("requires explicit")),JSON.stringify(invalid.issues));
});
test("staging legacy alias cannot point to another module or bypass canonical shell",()=>{
 const src=get(middleware);
 const r=verifyBoRuntimeSurfaceOwnership(undefined,{[middleware]:src.replace('target.searchParams.set("module", "subscriptions")','target.searchParams.set("module", "students")')});
 assert.equal(r.ok,false);
});
test("new module cannot opt out of special routing by claiming generic fallback",()=>{
 const manifest="app/bo/architecture/bo-runtime-surface-ownership.json";
 const m=JSON.parse(get(manifest));m.modules.futurePilot="generic";
 const source=get("public/bo-authority-source/school-adapters.js").replace("  subscriptions:{","  futurePilot:{label:'Future',fields:[]},\n  subscriptions:{");
 const out=verifyBoRuntimeSurfaceOwnership(undefined,{[manifest]:JSON.stringify(m),"public/bo-authority-source/school-adapters.js":source});
 assert.equal(out.ok,false);assert.match(out.issues.join(","),/generic UI owner forbidden/);
});test("canonical surface keeps S2 student search anchor",()=>{
 const p="app/bo/subscriptions/SubscriptionCreateDrawer.tsx",src=get(p);
 assert.equal(verifyBoRuntimeSurfaceOwnership(undefined,{[p]:src.replace('id="subscription-create-student-search"','id="student-search-removed"')}).ok,false);
});


test("PAP-1089 sidebar must import the canonical legacy URL key list, not an ad hoc second list",()=>{
 const sidebar=get("lib/bo-sidebar-routes.ts");
 const contract=get("lib/bo-url-contract.ts");
 assert.equal(verifyBoRuntimeSurfaceOwnership(undefined,{
  "lib/bo-sidebar-routes.ts":sidebar.replace("BO_LEGACY_QUERY_MODULES;","[\"students\",\"subscriptions\"];"),
 }).ok,false);
 const withoutSubscriptions=contract.replace('"students", "classes", "subscriptions", "enrollments"', '"students", "classes", "enrollments"');
 assert.notEqual(withoutSubscriptions,contract,"Fixture must remove a real legacy key");
 const result=verifyBoRuntimeSurfaceOwnership(undefined,{"lib/bo-url-contract.ts":withoutSubscriptions});
 assert.equal(result.ok,false);
 assert.match(result.issues.join(","),/sidebar URL whitelist/);
});
