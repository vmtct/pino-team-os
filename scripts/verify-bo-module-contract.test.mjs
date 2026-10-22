import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyBoModuleContract } from "./verify-bo-module-contract.mjs";

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const navFile="app/bo/navigation.ts",regFile="app/bo/architecture/registry.ts";
const baselineFile="app/bo/architecture/legacy-baseline.json";
const migrationFile="app/bo/architecture/legacy-migration-ledger.json";
function fixture() {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"pap926-bo-"));
  for(const name of [navFile,regFile,baselineFile,migrationFile]){
    const dest=path.join(tmp,name);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(path.join(repo,name),dest);
  }
  // Recreate frozen baseline pages as inert fixtures so receipt tests can
  // assert a clean migration transition without carrying 47 real modules.
  const baseline=JSON.parse(fs.readFileSync(path.join(tmp,baselineFile),"utf8"));
  for(const page of baseline.legacyRoutes){
    const dest=path.join(tmp,page);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,"export default function Page(){return null;}\n");
  }
  return tmp;
}
function edit(root,name,operation){
  const file=path.join(root,name);
  fs.writeFileSync(file,operation(fs.readFileSync(file,"utf8")));
}
function route(root,key,content){
  const name=`app/bo/${key}/page.tsx`;
  const filename=path.join(root,name);
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  fs.writeFileSync(filename,content);
}
const scaffold=(root,key="studio-test")=>spawnSync(process.execPath,
  [path.join(repo,"scripts/create-bo-module.mjs"),key,"Studio Test"],
  {encoding:"utf8",env:{...process.env,PINO_BO_CONTRACT_ROOT:root}});
const check=root=>verifyBoModuleContract(root).issues;
test("existing BO passes frozen baseline and has no unregistered NEW routes",()=>{
  const result=verifyBoModuleContract(repo);
  assert.deepEqual(result.issues,[]);
  assert.ok(result.baselineRoutes>35);
  assert.ok(result.baselineNav>30);
});
test("new route without registry FAILS",()=>{
  const root=fixture();
  try {
    route(root,"rogue",`export default function Page(){ return <table /> }`);
    assert.ok(check(root).some(s=>s.includes("Unregistered NEW BO page")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("new nav path without registered module FAILS",()=>{
  const root=fixture();
  try{
    edit(root,navFile,s=>s.replace('href: "/bo/learners"','href: "/bo/unregistered-thing"'));
    assert.ok(check(root).some(s=>s.includes("Unregistered NEW BO navigation")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("generator creates route+registry+navigation, but CI FAILS until domain adapter and permissions are real",()=>{
  const root=fixture();
  try{
    const result=scaffold(root);
    assert.equal(result.status,0,result.stderr);
    const first=check(root);
    assert.ok(first.some(s=>s.includes("Malformed BO module registry entry")),first.join("\n"));
    const repeat=scaffold(root);
    assert.notEqual(repeat.status,0);
    edit(root,regFile,s=>s.replace("TODO_READ_PERMISSION","studio.record.view").replace("TODO_WRITE_PERMISSION","studio.record.manage"));
    edit(root,"app/bo/studio-test/adapter.ts",s=>s.replace(
      'throw new Error("TODO_BO_DOMAIN_ADAPTER: implement Core-authenticated list with domain ACL");',
      "return []; // test fixture: simulated authorized Core adapter"));
    assert.deepEqual(check(root),[]);
    assert.equal(verifyBoModuleContract(root).newRoutes,1);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("rogue custom table in a registered new BO route FAILS",()=>{
  const root=fixture();
  try{
    assert.equal(scaffold(root).status,0);
    edit(root,regFile,s=>s.replace("TODO_READ_PERMISSION","studio.record.view").replace("TODO_WRITE_PERMISSION","studio.record.manage"));
    edit(root,"app/bo/studio-test/adapter.ts",s=>s.replace("TODO_BO_DOMAIN_ADAPTER","CORE_READY_ADAPTER"));
    edit(root,"app/bo/studio-test/page.tsx",s=>s.replace("return <BoModuleFactory","return <table /><BoModuleFactory"));
    assert.ok(check(root).some(s=>s.includes("bespoke Level-1 table")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("registered route lacking canonical BoModuleFactory FAILS",()=>{
  const root=fixture();
  try{
    assert.equal(scaffold(root).status,0);
    edit(root,regFile,s=>s.replace("TODO_READ_PERMISSION","studio.record.view").replace("TODO_WRITE_PERMISSION","studio.record.manage"));
    edit(root,"app/bo/studio-test/adapter.ts",s=>s.replace("TODO_BO_DOMAIN_ADAPTER","CORE_READY_ADAPTER"));
    edit(root,"app/bo/studio-test/page.tsx",s=>s.replace('moduleKey="studio-test"','moduleKey="wrong"'));
    assert.ok(check(root).some(s=>s.includes("MUST import BoModuleFactory")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("frozen legacy baseline cannot be expanded to camouflage a new custom page",()=>{
  const root=fixture();
  try{
    route(root,"backdoor","export default function Page(){return <table/>}");
    edit(root,baselineFile,s=>s.replace('"legacyRoutes": [','"legacyRoutes": [\n    "app/bo/backdoor/page.tsx",'));
    assert.ok(check(root).some(s=>s.includes("baseline hash mismatch")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("a registered module cannot omit navigation, ID, or permission mappings",()=>{
  const root=fixture();
  try{
    assert.equal(scaffold(root).status,0);
    edit(root,regFile,s=>s.replace("TODO_READ_PERMISSION","studio.record.view").replace("TODO_WRITE_PERMISSION","studio.record.manage"));
    edit(root,navFile,s=>s.replace(', { href: "/bo/studio-test", label: "Studio Test" }',""));
    let errors=check(root);
    assert.ok(errors.some(s=>s.includes("missing from BO navigation")));
    edit(root,regFile,s=>s.replace('key: "id", label: "ID", type: "id", readOnly: true','key: "id", label: "ID", type: "text", readOnly: false'));
    errors=check(root);
    assert.ok(errors.some(s=>s.includes("read-only canonical id")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

/* PAP-928 import-graph and decoy-entry regression tests. */
function readyNewModule(root){
  const outcome=scaffold(root);
  assert.equal(outcome.status,0,outcome.stderr);
  edit(root,regFile,s=>s.replace("TODO_READ_PERMISSION","studio.record.view")
    .replace("TODO_WRITE_PERMISSION","studio.record.manage"));
  edit(root,"app/bo/studio-test/adapter.ts",s=>s.replace(
    'throw new Error("TODO_BO_DOMAIN_ADAPTER: implement Core-authenticated list with domain ACL");',
    "return []; // fixture domain read"));
}
test("PAP-928 canonical generated route with ordinary domain helper imports passes",()=>{
  const root=fixture();
  try {
    readyNewModule(root);
    const adapter="app/bo/studio-test/adapter.ts";
    edit(root,adapter,s=>'import { assertDomain } from "./domain";\n'+s);
    const domain=path.join(root,"app/bo/studio-test/domain.ts");
    fs.writeFileSync(domain,'export const assertDomain = (x:unknown) => x !== null;\n');
    assert.deepEqual(check(root),[]);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-928 fake unused canonical JSX cannot authorize a bespoke default page",()=>{
  const root=fixture();
  try{
    readyNewModule(root);
    edit(root,"app/bo/studio-test/page.tsx",s=>s.replace(
      'return <BoModuleFactory moduleKey="studio-test" adapter={moduleAdapter} />;',
      'return <article>Not the BO Factory</article>;'));
    assert.ok(check(root).some(s=>s.includes("single canonical")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-928 dead extra JSX or a wrapper beside Factory fails",()=>{
  const root=fixture();
  try{
    readyNewModule(root);
    edit(root,"app/bo/studio-test/page.tsx",s=>s+
      '\nfunction Hidden(){ return <table><tbody /></table> }\n');
    assert.ok(check(root).some(s=>s.includes("hidden extra JSX")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-928 blocks a transitive direct imported custom table renderer",()=>{
  const root=fixture();
  try{
    readyNewModule(root);
    edit(root,"app/bo/studio-test/adapter.ts",s=>s+'\nimport { OddTable } from "./OddTable";\n');
    fs.writeFileSync(path.join(root,"app/bo/studio-test/OddTable.tsx"),
      'export function OddTable(){return <table><tbody /></table>};\n');
    assert.ok(check(root).some(s=>s.includes("transitive custom JSX renderer")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-928 blocks a multi-hop aliased custom JSX renderer import",()=>{
  const root=fixture();
  try{
    readyNewModule(root);
    edit(root,"app/bo/studio-test/adapter.ts",s=>s+'\nimport "./domain";\n');
    fs.writeFileSync(path.join(root,"app/bo/studio-test/domain.ts"),
      'import { Rogue } from "./presenter"; export const x = true;\n');
    fs.writeFileSync(path.join(root,"app/bo/studio-test/presenter.tsx"),
      'export const Rogue=()=> <div>Other view</div>;\n');
    assert.ok(check(root).some(s=>s.includes("transitive custom JSX renderer")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-928 blocks lazy import bypass in adapter",()=>{
  const root=fixture();
  try{
    readyNewModule(root);
    edit(root,"app/bo/studio-test/adapter.ts",s=>s+'\nconst lazy=()=>import("./other");\n');
    assert.ok(check(root).some(s=>s.includes("dynamic imports/element construction")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-928 blocks unresolvable local adapter dependencies",()=>{
  const root=fixture();
  try{
    readyNewModule(root);
    edit(root,"app/bo/studio-test/adapter.ts",s=>s+'\nimport { hidden } from "./not-present";\n');
    assert.ok(check(root).some(s=>s.includes("Unresolved local import")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-928 blocks React.createElement() transitive UI bypass",()=>{
  const root=fixture();
  try{
    readyNewModule(root);
    edit(root,"app/bo/studio-test/adapter.ts",s=>s+
      '\nimport React from "react"; const hidden=React.createElement("table");\n');
    assert.ok(check(root).some(s=>s.includes("dynamic imports/element construction")));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

/* PAP-929: frozen legacy migration ledger and no-resurrection tests. */
const LEGACY_PAGE="app/bo/learners/page.tsx";
const LEGACY_NAV="/bo/learners";
function ledgerEdit(root,fn) {
  const pathName=path.join(root,migrationFile);
  const ledger=JSON.parse(fs.readFileSync(pathName,"utf8"));
  fn(ledger);
  fs.writeFileSync(pathName,JSON.stringify(ledger,null,2)+"\n");
}
function adoptLegacyLearners(root) {
  const registry=fs.readFileSync(path.join(root,regFile),"utf8");
  const token="  // BO_NEW_MODULE_REGISTRATIONS — GENERATOR APPENDS ABOVE THIS LINE.";
  const def=`  defineBoModule({
    key: "learners", href: "/bo/learners", label: "Học viên", kind: "entity",
    permissions: { read: "student.record.view", write: "student.record.manage" },
    fields: [
      { key: "id", label: "ID", type: "id", readOnly: true },
      { key: "name", label: "Tên", type: "text" },
    ],
    publicViews: "module-shared", quickView: "canonical-properties", fullDetail: "shared-tabs",
  }),
${token}`;
  fs.writeFileSync(path.join(root,regFile),registry
    .replace("import { defineBoModuleRegistry, type BoModuleContract }",
      "import { defineBoModule, defineBoModuleRegistry, type BoModuleContract }")
    .replace(token,def));
  const dir=path.join(root,"app/bo/learners");
  fs.writeFileSync(path.join(dir,"page.tsx"),`"use client";
import { BoModuleFactory } from "@/app/bo/architecture/BoModuleFactory";
import { moduleAdapter } from "./adapter";
export default function LearnersPage() {
  return <BoModuleFactory moduleKey="learners" adapter={moduleAdapter} />;
}
`);
  fs.writeFileSync(path.join(dir,"adapter.ts"),`import type { BoModuleReadAdapter } from "@/app/bo/architecture/BoModuleFactory";
export const moduleAdapter: BoModuleReadAdapter = { async list(){ return []; } };
`);
  ledgerEdit(root,v=>{v.adoptedRoutes.push({path:LEGACY_PAGE,issue:"PAP-878"});
    v.adoptedNavigation.push({path:LEGACY_NAV,issue:"PAP-878"});});
}
test("PAP-929 pre-existing route/nav baseline with empty ledger still passes",()=>{
  const root=fixture();
  try{assert.deepEqual(check(root),[]);}
  finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 old route deletion without retirement receipt fails",()=>{
  const root=fixture();
  try{
    fs.rmSync(path.join(root,LEGACY_PAGE));
    assert.ok(check(root).some(x=>x.includes("disappeared without retirement receipt")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 retired route must be absent and cannot resurrect under baseline exemption",()=>{
  const root=fixture();
  try{
    fs.rmSync(path.join(root,LEGACY_PAGE));
    ledgerEdit(root,v=>v.retiredRoutes.push({path:LEGACY_PAGE,issue:"PAP-878"}));
    assert.deepEqual(check(root),[]);
    fs.writeFileSync(path.join(root,LEGACY_PAGE),"export default function Page(){return <table/>}");
    assert.ok(check(root).some(x=>x.includes("Retired legacy BO page reintroduced")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 canonical adoption of a formerly grandfathered old route passes",()=>{
  const root=fixture();
  try{
    adoptLegacyLearners(root);
    assert.deepEqual(check(root),[]);
    assert.equal(verifyBoModuleContract(root).legacyCoverage.adoptedRoutes,1);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 adopted old route no longer bypasses canonical renderer checks",()=>{
  const root=fixture();
  try{
    adoptLegacyLearners(root);
    edit(root,LEGACY_PAGE,s=>s.replace('moduleKey="learners"','moduleKey="rogue"'));
    assert.ok(check(root).some(x=>x.includes("MUST import BoModuleFactory")||x.includes("single canonical")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 registering old module without ledger receipt fails",()=>{
  const root=fixture();
  try{
    adoptLegacyLearners(root);
    ledgerEdit(root,v=>{v.adoptedRoutes=[];v.adoptedNavigation=[];});
    assert.ok(check(root).some(x=>x.includes("Registered legacy BO page requires adoption receipt")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 legacy nav deletion needs receipt, then cannot resurrect",()=>{
  const root=fixture();
  try{
    edit(root,navFile,s=>s.replace('href: "/bo/learners"','href: "/private-retired-path"'));
    assert.ok(check(root).some(x=>x.includes("Legacy navigation disappeared without retirement receipt")));
    ledgerEdit(root,v=>v.retiredNavigation.push({path:LEGACY_NAV,issue:"PAP-878"}));
    assert.deepEqual(check(root),[]);
    edit(root,navFile,s=>s.replace('href: "/private-retired-path"','href: "/bo/learners"'));
    assert.ok(check(root).some(x=>x.includes("Retired legacy BO navigation reintroduced")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 strict mode cannot activate with even one unclassified legacy route/nav",()=>{
  const root=fixture();
  try{
    ledgerEdit(root,v=>v.strictLegacy=true);
    const errors=check(root);
    assert.ok(errors.some(x=>x.includes("Strict BO legacy mode cannot grandfather route")));
    assert.ok(errors.some(x=>x.includes("Strict BO legacy mode cannot grandfather navigation")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 invalid issue, duplicate and contradictory ledger dispositions fail",()=>{
  const root=fixture();
  try{
    fs.rmSync(path.join(root,LEGACY_PAGE));
    ledgerEdit(root,v=>{
      v.retiredRoutes.push({path:LEGACY_PAGE,issue:"INVALID"});
      v.retiredRoutes.push({path:LEGACY_PAGE,issue:"PAP-878"});
      v.adoptedRoutes.push({path:LEGACY_PAGE,issue:"PAP-878"});
    });
    const errors=check(root);
    assert.ok(errors.some(x=>x.includes("Invalid/duplicate legacy retiredRoutes")));
    assert.ok(errors.some(x=>x.includes("conflicting adopted+retired")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 unknown paths outside frozen baseline and unsupported fields fail",()=>{
  const root=fixture();
  try{
    ledgerEdit(root,v=>{
      v.retiredRoutes.push({path:"app/bo/never-existed/page.tsx",issue:"PAP-878"});
      v.surprise=true;
    });
    assert.ok(check(root).some(x=>x.includes("Invalid BO legacy ledger")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test("PAP-929 entry outside immutable legacy baseline fails with a valid ledger schema",()=>{
  const root=fixture();
  try{
    ledgerEdit(root,v=>v.retiredRoutes.push({path:"app/bo/nonlegacy/page.tsx",issue:"PAP-878"}));
    assert.ok(check(root).some(x=>x.includes("Invalid/duplicate legacy retiredRoutes")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("PAP-929 missing retirement ledger fails closed even when no routes are migrated",()=>{
  const root=fixture();
  try{
    fs.rmSync(path.join(root,migrationFile));
    assert.ok(check(root).some(x=>x.includes("Missing/malformed BO legacy migration ledger")));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
