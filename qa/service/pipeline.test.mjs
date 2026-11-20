import { test } from "node:test";
import assert from "node:assert/strict";
import { openQueue } from "./queue.mjs";
import { validateRelease,runBatch } from "./pipeline.mjs";
import { validateBaseline } from "./baseline.mjs";
const revision="a".repeat(40), version="a1111111-1111-1111-1111-111111111111";
const repo={full_name:"vmtct/pino-team-os"};
const run={id:123,repository:repo,head_repository:repo,path:".github/workflows/candidate-staging-deploy.yml",name:"Team Staging CD (Guarded)",head_branch:"main",head_sha:revision,event:"workflow_run",status:"completed",conclusion:"success"};
const receipt={kind:"TEAM_GUARDED_STAGING_CD",result:"SERVING_BOUNDARY_PASS",sourceSha:revision,runId:"123",productionMutation:false,activeVersionId:version,previousVersionId:"b"+version.slice(1),coreVersion:version};
const registry=suites=>({schemaVersion:1,policy:"AUTOMATION_SCOPE_REGRESSION_ONLY_V1",suites});
test("exact successful guarded Team CD receipt",()=>{
  assert.equal(validateRelease(receipt,run,revision).cdRunId,123);
  for(const patch of [{head_branch:"feature"},{head_repository:{full_name:"fork/os"}},{path:"other"},{conclusion:"failure"},{event:"pull_request"},{head_sha:"b".repeat(40)},{id:124}]) assert.throws(()=>validateRelease(receipt,{...run,...patch},revision),/NOT_ADMITTED/);
  for(const patch of [{result:"FAILED"},{productionMutation:true},{sourceSha:"b".repeat(40)},{runId:"124"},{activeVersionId:"x"},{previousVersionId:version}]) assert.throws(()=>validateRelease({...receipt,...patch},run,revision),/NOT_ADMITTED/);
});
test("manifest presence alone is never regression acceptance",()=>{
  const empty=registry([]);assert.deepEqual(validateBaseline(empty),[]);
  const q=openQueue(":memory:");let calls=0;
  try{
    const result=runBatch(q,validateRelease(receipt,run,revision),()=>calls++,empty);
    assert.equal(result.state,"NO_ACCEPTED_BASELINE");assert.equal(result.evidence,"AUTO_REGRESSION");
    assert.equal(calls,0);assert.deepEqual(q.list(),[]);
  }finally{q.close();}
});
test("only explicit accepted suite registrations are selected",()=>{
  const entry={surface:"bo",feature:"payroll-exceptions",acceptanceRef:"PAP-2197#45056",acceptedAt:"2026-11-19T21:00:00.000Z",testFiles:[{path:"lib/example.test.ts",sha256:"c".repeat(64)}]};
  assert.deepEqual(validateBaseline(registry([entry])),[entry]);
  for(const patch of [{acceptanceRef:"PAP-2197"},{acceptedAt:"yesterday"},{feature:"../student"},{surface:"prod"}])
    assert.throws(()=>validateBaseline(registry([{...entry,...patch}])),/INVALID_REGRESSION_BASELINE/);
  assert.throws(()=>validateBaseline(registry([entry,entry])),/INVALID_REGRESSION_BASELINE/);
});
test("accepted suite batch is restricted to allowlist and deduplicates",()=>{
  const q=openQueue(":memory:"),entry={surface:"bo",feature:"payroll-exceptions",acceptanceRef:"PAP-2197#45056",acceptedAt:"2026-11-19T21:00:00.000Z",testFiles:[{path:"lib/example.test.ts",sha256:"c".repeat(64)}]};
  let seen=0;
  try{
    const one=runBatch(q,validateRelease(receipt,run,revision),(queue,job)=>{seen++;queue.finish(job.id,"PASS",{revision,evidence:"LOCAL_ONLY",groups:[]});},registry([entry]),()=>true);
    assert.equal(one.state,"PASS");assert.equal(seen,1);assert.equal(one.jobs[0].acceptanceRef,entry.acceptanceRef);
    const again=runBatch(q,validateRelease(receipt,run,revision),()=>assert.fail("duplicate baseline must not replay"),registry([entry]),()=>true);
    assert.equal(again.state,"PASS");
  }finally{q.close();}
});
test("accepted baseline pins exact manifest test list and test file hashes",async()=>{
  const fs=await import("node:fs");
  const os=await import("node:os");
  const path=await import("node:path");
  const crypto=await import("node:crypto");
  const {verifyAcceptedSuite}=await import("./baseline.mjs");
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"pino-baseline-"));
  try{
    fs.mkdirSync(path.join(root,"qa/cases/bo"),{recursive:true});
    fs.mkdirSync(path.join(root,"lib"),{recursive:true});
    const source="export const stable=true;";
    fs.writeFileSync(path.join(root,"lib/approved.test.ts"),source);
    fs.writeFileSync(path.join(root,"qa/cases/bo/student.json"),JSON.stringify({tests:["lib/approved.test.ts"]}));
    const entry={surface:"bo",feature:"student",acceptanceRef:"PAP-2198#45519",acceptedAt:"2026-11-20T10:00:00.000Z",
      testFiles:[{path:"lib/approved.test.ts",sha256:crypto.createHash("sha256").update(source).digest("hex")}]};
    assert.equal(verifyAcceptedSuite("bo","student",[entry],root),true);
    fs.writeFileSync(path.join(root,"lib/approved.test.ts"),source+"\\n// expanded");
    assert.throws(()=>verifyAcceptedSuite("bo","student",[entry],root),/BASELINE_TEST_HASH_DRIFT/);
    fs.writeFileSync(path.join(root,"lib/approved.test.ts"),source);
    fs.writeFileSync(path.join(root,"qa/cases/bo/student.json"),JSON.stringify({tests:["lib/approved.test.ts","lib/other.test.ts"]}));
    assert.throws(()=>verifyAcceptedSuite("bo","student",[entry],root),/BASELINE_TESTSET_DRIFT/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test("active or unrelated queue work fails closed",()=>{
  for(const other of [{surface:"ho",feature:"person",revision},{surface:"bo",feature:"payroll-exceptions",revision:"b".repeat(40)}]){
    const q=openQueue(":memory:");
    try{
      q.enqueue(other);q.claim();
      assert.throws(()=>runBatch(q,validateRelease(receipt,run,revision),()=>assert.fail("no execution"),
        registry([{surface:"bo",feature:"payroll-exceptions",acceptanceRef:"PAP-2197#45056",acceptedAt:"2026-11-19T21:00:00.000Z",testFiles:[{path:"lib/example.test.ts",sha256:"c".repeat(64)}]}]),()=>true),/QUEUE_NOT_EXCLUSIVE/);
    }finally{q.close();}
  }
});
