import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditBoV23, authorityManifest, reachableSource, verifyAuthorityRoot } from "./verify-bo-v23-parity.mjs";
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"pap889-parity-"));
 const write=(rel,data)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data)};
 const load=rel=>fs.readFileSync(path.join(root,rel),"utf8");
 write("docs/bo-v23-ui-authority.json",fs.readFileSync(path.join(repo,"docs/bo-v23-ui-authority.json")));
 write("app/bo/architecture/legacy-migration-ledger.json",JSON.stringify({version:1,strictLegacy:false,adoptedRoutes:[],retiredRoutes:[],adoptedNavigation:[],retiredNavigation:[]}));
 write("app/bo/learners/page.tsx",'import {Students} from "./BoLearnersView"; export default function Page(){return <Students/>;}');
 write("app/bo/running-classes/page.tsx",'import {RunningClasses} from "../BoOperationalView";export default function Page(){return <RunningClasses/>;}');
 write("app/bo/components/data-grid/BoDataGrid.tsx",'export function BoDataGrid({onCellCommit}){return <table/>;}');
 write("app/bo/components/Canonical.tsx",'export const BoDrawer=()=> <aside/>;export const BoQuickViewOpener=()=> <button data-bo-v23-opener/>;export const BoTableSettings=()=> <aside/>;export const BoSharedViewTabs=()=> <nav/>;export const BoFullDetail=()=> <section/>;');
 const imports='import {BoDrawer,BoQuickViewOpener,BoTableSettings,BoSharedViewTabs,BoFullDetail} from "@/app/bo/components/Canonical";\nimport {BoDataGrid} from "@/app/bo/components/data-grid/BoDataGrid";\n';
 write("app/bo/learners/BoLearnersView.tsx",imports+'export function Students(){const columns=[{key:"id"},{key:"name"}];return <><BoDataGrid onCellCommit={()=>{}}/><BoQuickViewOpener/><BoDrawer/><BoTableSettings/><BoSharedViewTabs/><BoFullDetail/></>;}');
 write("app/bo/BoOperationalView.tsx",imports+'export function RunningClasses(){const columns=[{key:"id"}];return <><BoDataGrid onCellCommit={()=>{}} onRowOpen={()=>{}}/><BoQuickViewOpener/><BoDrawer/><BoTableSettings/><BoSharedViewTabs/><BoFullDetail/></>;}');
 return{root,write,load};
}
function withFixture(fn){const f=fixture();try{return fn(f)}finally{fs.rmSync(f.root,{recursive:true,force:true})}}
test("Founder anchor hashes, 13 immutable source files and exact pilot route keys",()=>{
 const m=authorityManifest(repo);
 assert.equal(Object.keys(m.sourceSha256).length,13);
 assert.equal(m.pilot.students.route,"app/bo/learners/page.tsx");
 assert.equal(m.pilot.classes.route,"app/bo/running-classes/page.tsx");
});
test("adopted-mode without pilot ledger receipt is PENDING, not parity PASS",()=>{
 const r=withFixture(({root})=>auditBoV23(root,"adopted"));
 assert.equal(r.status,"PENDING_ADOPTION");assert.equal(r.selectedRoutes,0);
});
test("valid integrated fixture passes static contract detection for both pilots",()=>{
 const r=withFixture(({root})=>auditBoV23(root,"pilot"));
 assert.equal(r.status,"STATIC_PASS_ONLY",r.failures.join("\n"));
 assert.equal(r.selectedRoutes,2);
});
test("draft-only grid capability without owner mutation wiring cannot satisfy typed inline edit",()=>{
 const r=withFixture(({root,write,load})=>{
  const grid="app/bo/components/data-grid/BoDataGrid.tsx";
  write(grid,'export function BoDataGrid({onStageCellEdit}){return <BoInlineDraftCell/>;}');
  for(const owner of ["app/bo/learners/BoLearnersView.tsx","app/bo/BoOperationalView.tsx"]){
   write(owner,load(owner).replace(/ onCellCommit=\{\(\)=>\{\}\}/g,""));
  }
  return auditBoV23(root,"pilot");
 });
 for(const key of ["students","classes"])
  assert.ok(r.failures.some(x=>x.includes(key+":typed_inline_edit")),key);
});test("strict pilot rejects missing actual BO table despite component source existing",()=>{
 const r=withFixture(({root,write})=>{
  write("app/bo/learners/BoLearnersView.tsx","export function Students(){return <section/>}");
  return auditBoV23(root,"pilot");
 });
 assert.equal(r.status,"NOT_PARITY_READY");
 assert.ok(r.failures.some(x=>x.includes("students:canonical_table")));
});
test("adopted route triggers static fail, unrelated legacy remains exempt",()=>{
 const r=withFixture(({root,write,load})=>{
  const p="app/bo/architecture/legacy-migration-ledger.json",data=JSON.parse(load(p));
  data.adoptedRoutes=[{path:"app/bo/learners/page.tsx",issue:"PAP-891"}];
  write(p,JSON.stringify(data));
  write("app/bo/learners/BoLearnersView.tsx","export function Students(){return <table/>}");
  return auditBoV23(root,"adopted");
 });
 assert.equal(r.selectedRoutes,1);assert.equal(r.status,"NOT_PARITY_READY");
 assert.ok(r.failures.some(x=>x.includes("students:")));
});
test("detached component definition does not satisfy mount check",()=>{
 const r=withFixture(({root,write,load})=>{
  const p="app/bo/learners/BoLearnersView.tsx";
  write(p,load(p).replace("<BoSharedViewTabs/>",""));
  write("app/bo/components/Standalone.tsx","export const Unused=()=> <BoSharedViewTabs/>;");
  return auditBoV23(root,"pilot");
 });
 assert.ok(r.failures.some(x=>x.includes("students:saved_view_tabs")));
});
test("legacy rail, avatars and old filter toolbar are detected",()=>{
 const r=withFixture(({root,write,load})=>{
  const p="app/bo/learners/BoLearnersView.tsx";
  write(p,load(p).replace("return <>",'return <><div className={styles.metrics}/><span className={styles.avatarSmall}/><BoDataGrid toolbarActions={<label/>}/>'));
  return auditBoV23(root,"pilot");
 });
 for(const part of ["no_metric_rail","no_row_avatars","no_separate_filter"])
  assert.ok(r.failures.some(x=>x.includes("students:"+part)),part);
});
test("manifest SHA drift is rejected without trusting edited approval JSON",()=>{
 withFixture(({root,write,load})=>{
  const p="docs/bo-v23-ui-authority.json",m=JSON.parse(load(p));
  m.sourceSha256["playground.js"]="0".repeat(64);write(p,JSON.stringify(m));
  assert.throws(()=>auditBoV23(root,"pilot"),/SHA anchor drift/);
 });
});
test("optional OneDrive authority validation checks all 13 files",()=>{
 const errors=withFixture(({root})=>verifyAuthorityRoot(root,path.join(root,"missing")));
 assert.equal(errors.length,13);
});
test("import graph does not count unrelated declared components",()=>{
 withFixture(({root,write})=>{
  write("app/bo/Unreferenced.tsx","export const Other=()=> <BoSharedViewTabs/>");
  const graph=reachableSource(root,"app/bo/learners/page.tsx");
  assert.ok(graph.has("app/bo/learners/BoLearnersView.tsx"));
  assert.ok(!graph.has("app/bo/Unreferenced.tsx"));
 });
});
