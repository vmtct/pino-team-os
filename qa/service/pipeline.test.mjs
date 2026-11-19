import { test } from "node:test";
import assert from "node:assert/strict";
import { openQueue } from "./queue.mjs";
import { validateRelease,runBatch } from "./pipeline.mjs";
const revision="a".repeat(40), version="a1111111-1111-1111-1111-111111111111";
const repo={full_name:"vmtct/pino-team-os"};
const run={id:123,repository:repo,head_repository:repo,path:".github/workflows/candidate-staging-deploy.yml",name:"Team Staging CD (Guarded)",head_branch:"main",head_sha:revision,event:"workflow_run",status:"completed",conclusion:"success"};
const receipt={kind:"TEAM_GUARDED_STAGING_CD",result:"SERVING_BOUNDARY_PASS",sourceSha:revision,runId:"123",productionMutation:false,activeVersionId:version,previousVersionId:"b"+version.slice(1),coreVersion:version};
test("exact successful guarded Team CD receipt",()=>{
  assert.equal(validateRelease(receipt,run,revision).cdRunId,123);
  for(const patch of [{head_branch:"feature"},{head_repository:{full_name:"fork/os"}},{path:"other"},{conclusion:"failure"},{event:"pull_request"},{head_sha:"b".repeat(40)},{id:124}]) assert.throws(()=>validateRelease(receipt,{...run,...patch},revision),/NOT_ADMITTED/);
  for(const patch of [{result:"FAILED"},{productionMutation:true},{sourceSha:"b".repeat(40)},{runId:"124"},{activeVersionId:"x"},{previousVersionId:version}]) assert.throws(()=>validateRelease({...receipt,...patch},run,revision),/NOT_ADMITTED/);
});
test("batch executes all three surfaces, reports failure, dedup does not replay",()=>{
  const q=openQueue(":memory:");const scope=validateRelease(receipt,run,revision);
  const seen=[];
  try{
    const first=runBatch(q,scope,(queue,job)=>{seen.push(job.surface);queue.finish(job.id,job.surface==="bo"?"FAIL":"PASS",{revision,evidence:"LOCAL_ONLY",groups:[]});});
    assert.deepEqual(seen,["ho","bo","tos"]);assert.equal(first.state,"FAIL");
    const again=runBatch(q,scope,()=>assert.fail("no duplicate execution"));assert.equal(again.state,"FAIL");
  }finally{q.close();}
});
test("prior active or unrelated queue work fails closed",()=>{
  for(const unrelated of [false,true]){
    const q=openQueue(":memory:");
    try{
      q.enqueue({surface:"ho",revision:unrelated?"b".repeat(40):revision});q.claim();
      assert.throws(()=>runBatch(q,validateRelease(receipt,run,revision),()=>assert.fail("no execution")),/QUEUE_NOT_EXCLUSIVE/);
    }finally{q.close();}
  }
});
