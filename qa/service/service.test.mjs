import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openQueue } from "./queue.mjs";
import { classifyResult, executeClaim, expectedGroups } from "./worker.mjs";

const sha="a".repeat(40), selection={surface:"bo",feature:"student",revision:sha};
const expected=["shared-staging-proof","student"];
const output=(results=["PASS","PASS"])=>expected.map((feature,i)=>JSON.stringify({surface:"bo",feature,mode:"local",result:results[i],elapsedMs:1})).join("\n");
function withDb(fn) {
  const dir=mkdtempSync(join(tmpdir(),"pino-qa-local-"));
  try{fn(join(dir,"queue.db"));}finally{rmSync(dir,{recursive:true,force:true});}
}
test("durable dedup and exclusive claim across two connections",()=>withDb(path=>{
  const a=openQueue(path),b=openQueue(path);
  try{
    const first=a.enqueue(selection);
    assert.equal(b.enqueue(selection).id,first.id);
    const second=b.enqueue({...selection,surface:"ho",feature:"person"});
    assert.equal(a.list().length,2);
    const claimed=a.claim();assert.equal(claimed.id,first.id);assert.equal(claimed.state,"RUNNING");
    assert.equal(b.claim(),null);assert.throws(()=>b.finish(second.id,"PASS",{}),/CLAIM_NOT_RUNNING/);
    a.finish(claimed.id,"PASS",{ok:true});assert.equal(b.claim().state,"RUNNING");
  }finally{a.close();b.close();}
  const reopened=openQueue(path);
  try{assert.equal(reopened.list().length,2);assert.equal(reopened.claim(),null);assert.ok(reopened.list().some(j=>j.state==="PASS"));}finally{reopened.close();}
}));
test("invalid selection and state fail closed",()=>withDb(path=>{
  const q=openQueue(path);
  try{
    for(const patch of [{surface:"shell"},{feature:"../x"},{revision:"main"}]) assert.throws(()=>q.enqueue({...selection,...patch}),/INVALID_LOCAL_SELECTION/);
    const job=q.enqueue(selection);q.claim();
    assert.throws(()=>q.finish(job.id,"QUEUED",{}),/INVALID_TERMINAL_STATE/);
    assert.equal(q.list()[0].state,"RUNNING");
  }finally{q.close();}
}));
test("registry selects existing local manifest groups",()=>{
  assert.deepEqual(expectedGroups("bo","student"),expected);
  assert.throws(()=>expectedGroups("bo","nonexistent"),/UNKNOWN_LOCAL_CASE/);
  assert.throws(()=>expectedGroups("../",""),/INVALID_SURFACE/);
});
test("complete ordered receipts with matching exit classify PASS or FAIL",()=>{
  assert.equal(classifyResult(selection,expected,{status:0,stdout:output()}).state,"PASS");
  assert.equal(classifyResult(selection,expected,{status:1,stdout:output(["PASS","FAIL"])}).state,"FAIL");
});
test("missing, duplicate, foreign or contradictory receipts cannot pass",()=>{
  for(const raw of [
    {status:0,stdout:""},{status:0,stdout:output()+"\n"+output()},
    {status:0,stdout:output().replace('"surface":"bo"','"surface":"ho"')},
    {status:0,stdout:output().replace('"elapsedMs":1','"elapsedMs":-1')},
    {status:0,stdout:output(["PASS","FAIL"])},{status:1,stdout:output()},
    {status:0,stdout:output(),error:Error("spawn")},{status:null,signal:"SIGTERM",stdout:output()}
  ]) assert.equal(classifyResult(selection,expected,raw).state,"BLOCKED");
});
test("source drift before prevents run; after invalidates pass",()=>withDb(path=>{
  const q=openQueue(path);
  try{
    q.enqueue(selection);
    const before=executeClaim(q,q.claim(),{revision:()=>null,groups:()=>expected,run:()=>{throw Error("must not run")}});
    assert.equal(before.state,"INVALIDATED");
    q.enqueue({...selection,revision:"b".repeat(40)});
    let reads=0;
    const after=executeClaim(q,q.claim(),{revision:()=>reads++?"c".repeat(40):"b".repeat(40),groups:()=>expected,run:()=>({status:0,stdout:output()})});
    assert.equal(after.state,"INVALIDATED");assert.equal(JSON.parse(after.receipt).reason,"SOURCE_DRIFT_AFTER");
  }finally{q.close();}
}));
test("receipt persists local-only proof and unexpected runner error blocks",()=>withDb(path=>{
  const q=openQueue(path);
  try{
    q.enqueue(selection);
    const result=executeClaim(q,q.claim(),{revision:()=>sha,groups:()=>expected,run:()=>({status:0,stdout:output()})});
    const receipt=JSON.parse(result.receipt);
    assert.equal(result.state,"PASS");assert.equal(receipt.evidence,"LOCAL_ONLY");assert.equal(receipt.groups.length,2);
    q.enqueue({...selection,feature:"payroll-daily"});
    const blocked=executeClaim(q,q.claim(),{revision:()=>sha,groups:()=>expected,run:()=>{throw Error("fake failure")}});
    assert.equal(blocked.state,"BLOCKED");
  }finally{q.close();}
}));
