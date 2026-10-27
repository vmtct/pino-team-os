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
test("orphaned specialized UI and missing DOM marker fail closed",()=>{
 const e=get(entry),u=get(ui);
 assert.equal(verifyBoRuntimeSurfaceOwnership(undefined,{[entry]:e.replace("<BoSubscriptionsView embedded />","undefined")}).ok,false);
 assert.equal(verifyBoRuntimeSurfaceOwnership(undefined,{[ui]:u.replace('data-bo-runtime-surface="subscriptions-core"','data-bo-runtime-surface="generic"')}).ok,false);
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
