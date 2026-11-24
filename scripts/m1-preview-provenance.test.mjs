import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRegistration, readAssets } from "./m1-preview-provenance.mjs";

const revision="a".repeat(40);
const spec=()=>({jiraTask:"PAP-2345",epicCode:"PLT-M1-DELIVERY",surface:"ho",sourceRevision:revision,
  reviewUrl:"http://192.168.1.6:8800/ho/staff?m1Preview=1",fixtureId:"STAFF-MOCK-001",
  sourceFiles:{route:"app/ho/staff/page.tsx",renderer:"app/ho/staff/StaffManualPreview.tsx",schema:"app/ho/staff/schema.ts",fixture:"app/ho/staff/manual-create-preview.ts"}});
const readSource=path=>Buffer.from(path);
const assets=()=>[{path:"index.html",bytes:Buffer.from("test-only")},{path:"assets/app.js",bytes:Buffer.from("test-only javascript")}];

test("registration is deterministic and never claims runtime approval",()=>{
  const r=createRegistration(spec(),revision,readSource,assets());
  assert.deepEqual(r,createRegistration(spec(),revision,readSource,assets().reverse()));
  assert.equal(r.sourceRevision,revision);
  assert.equal(r.artifact.files.length,2);
  assert.equal(r.servingVerified,false);
  assert.equal(r.admissionVerified,false);
  assert.equal(r.founderGate,"PENDING_MANUAL");
});
test("source mismatch and artifact changes are distinguishable",()=>{
  const r=createRegistration(spec(),revision,readSource,assets());
  assert.throws(()=>createRegistration(spec(),"b".repeat(40),readSource,assets()));
  const a=assets();a[0].bytes=Buffer.from("changed");
  assert.notEqual(r.artifact.sha256,createRegistration(spec(),revision,readSource,a).artifact.sha256);
});
test("reject noncanonical routes, bad source paths and identities",()=>{
  for(const patch of [{reviewUrl:"http://192.168.1.6:8898/ho"},{reviewUrl:"http://192.168.1.6:8800/bo"},{reviewUrl:"https://ho.staging.pinohouse.art/ho"},{fixtureId:"real-id"},{jiraTask:"unknown"},{sourceFiles:{...spec().sourceFiles,route:"app/../lib/private.ts"}}]){
    assert.throws(()=>createRegistration({...spec(),...patch},revision,readSource,assets()));
  }
});
test("reject empty, duplicate, ambiguous and traversing assets",()=>{
  for(const entries of [[],[{path:"../private.txt",bytes:Buffer.from("x")}],[{path:"empty",bytes:Buffer.alloc(0)}],[...assets(),{path:"INDEX.HTML",bytes:Buffer.from("x")}]])
    assert.throws(()=>createRegistration(spec(),revision,readSource,entries));
});
test("read offline artifact tree without mutating it",()=>{
  const root=mkdtempSync(join(tmpdir(),"pap2345-test-"));
  try {
    mkdirSync(join(root,"assets"));
    writeFileSync(join(root,"assets","app.js"),"test");
    writeFileSync(join(root,"index.html"),"test");
    assert.deepEqual(readAssets(root).map(x=>x.path).sort(),["assets/app.js","index.html"]);
  } finally {rmSync(root,{recursive:true,force:true});}
});
