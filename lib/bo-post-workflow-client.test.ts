import {test} from "node:test";
import assert from "node:assert/strict";
import {postWorkflowClient,snapshotWorkflow,PostWorkflowError,type WorkflowCommand} from "../app/bo/piner-posts/workflow-client";
const uid=(n:number)=>"01800000-0000-7000-8000-"+String(n).padStart(12,"0");
const common={postId:uid(1),expectedVersion:4,idempotencyKey:"workflow-client-0001"},center=uid(2);
const signal=new AbortController().signal;
test("PAP-2386 snapshot preserves authored media order and freezes caller input",()=>{
 const a=[uid(4),uid(3)];const c=snapshotWorkflow({...common,kind:"submit",attachmentIds:a});a.reverse();
 assert.deepEqual(c.kind==="submit"&&c.attachmentIds,[uid(4),uid(3)]);
 assert.throws(()=>snapshotWorkflow({...common,kind:"submit",attachmentIds:[uid(3),uid(3)]}));
 const selection=snapshotWorkflow({...common,kind:"diary-selection",diaryIds:[uid(4),uid(3)]});
 assert.deepEqual(selection.kind==="diary-selection"&&selection.diaryIds,[uid(3),uid(4)]);
});
test("PAP-2386 exact submit request and pending receipt",async()=>{
 const call=postWorkflowClient(center,async (url,init)=>{
  assert.equal(url,"/api/bo/learning/piner-posts/"+common.postId+"/submit?centerId="+center);
  assert.equal(init?.method,"POST");assert.equal(init?.credentials,"same-origin");assert.equal(new Headers(init?.headers).get("idempotency-key"),common.idempotencyKey);
  assert.deepEqual(JSON.parse(String(init?.body)),{expectedVersion:4,attachmentIds:[uid(3)]});
  return Response.json({data:{post:{id:common.postId,centerId:center,status:"PENDING_APPROVAL",version:5},committedVersion:5,replayed:false}});
 });
 assert.equal((await call({...common,kind:"submit",attachmentIds:[uid(3)]},signal)).committedVersion,5);
});
test("PAP-2386 wrong target/version and ambiguous transport reject without automatic retry",async()=>{
 let calls=0;const c:WorkflowCommand={...common,kind:"diary-provenance",attachmentId:uid(3),diaryId:uid(4),evidenceId:uid(5),expectedAttachmentVersion:2,transform:"RAW"};
 const wrong=postWorkflowClient(center,async()=>{calls++;return Response.json({data:{attachmentId:uid(6),committedVersion:5,replayed:false}});});
 await assert.rejects(wrong(c,signal),e=>e instanceof PostWorkflowError&&e.uncertain);assert.equal(calls,1);
 const net=postWorkflowClient(center,async()=>{calls++;throw Error("network");});
 await assert.rejects(net(c,signal),e=>e instanceof PostWorkflowError&&e.uncertain);assert.equal(calls,2);
 const denied=postWorkflowClient(center,async()=>Response.json({}, {status:403}));
 await assert.rejects(denied(c,signal),e=>e instanceof PostWorkflowError&&e.status===403&&!e.uncertain);
});
