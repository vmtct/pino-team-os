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
function fixture() {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"pap926-bo-"));
  for(const name of [navFile,regFile,baselineFile]){
    const dest=path.join(tmp,name);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(path.join(repo,name),dest);
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
