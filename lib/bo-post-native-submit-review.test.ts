import {test} from "node:test";
import assert from "node:assert/strict";
import {createNativeSubmitReview} from "../app/bo/piner-posts/native-submit-review";
import type {WorkflowCommand} from "../app/bo/piner-posts/workflow-client";
import type {CoreDraftRow} from "../app/bo/piner-posts/core-draft-client";
const id=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0"),center=id(1),post=id(2),a=id(3),b=id(4),signal=new AbortController().signal;
function fixture(){
 let pending=false,uncertain=false,submitted=false,allowed=true;
 const calls:WorkflowCommand[]=[];
 const row={id:post,centerId:center,status:"Nháp",caption:"QA",version:5,mediaCount:2} as CoreDraftRow;
 const item=(id:string)=>({id,state:"READY" as const,mimeType:"image/png" as const,byteSize:1,version:2,postVersion:5,expiresAt:"2026-11-25T12:00:00Z"});
 const execute=async(c:WorkflowCommand)=>{calls.push(c);if(uncertain){pending=true;throw Error("Lost acknowledgement");}pending=false;submitted=true;return {command:c,committedVersion:6,replayed:calls.length>1};};
 const review=createNativeSubmitReview({centerId:center,canSubmit:()=>allowed,detail:async()=>submitted?{...row,status:"Chờ duyệt",version:6}:row,list:async()=>({attachments:[item(a),item(b)],mediaCount:2,postVersion:5}),workflow:{run:execute,retry:execute,hasPending:async()=>pending},newKey:()=>"native-submit-test-0001"});
 return {review,calls,uncertain:()=>{uncertain=true;},clear:()=>{uncertain=false;},deny:()=>{allowed=false;},unknown:()=>{pending=true;}};
}
test("PAP-2386 native review preserves exact authored order and canonical pending detail",async()=>{
 const x=fixture();assert.equal((await x.review.submit(post,5,[b,a],signal)).status,"Chờ duyệt");
 assert.deepEqual(x.calls,[{kind:"submit",postId:post,expectedVersion:5,attachmentIds:[b,a],idempotencyKey:"native-submit-test-0001"}]);
});
test("PAP-2386 review denies stale, incomplete, foreign order and missing capability before dispatch",async()=>{
 const x=fixture();for(const [version,order] of [[4,[a,b]],[5,[a]],[5,[a,a]],[5,[a,id(9)]]] as const)await assert.rejects(x.review.submit(post,version,order,signal));
 x.deny();await assert.rejects(x.review.submit(post,5,[a,b],signal));assert.equal(x.calls.length,0);
});
test("PAP-2386 review retains exact lost-ACK intent, no new command, no guessed reload retry",async()=>{
 const x=fixture();x.uncertain();await assert.rejects(x.review.submit(post,5,[b,a],signal));
 assert.deepEqual(await x.review.pending(signal),{pending:true,retryPostId:post});
 await assert.rejects(x.review.submit(post,5,[a,b],signal));await assert.rejects(x.review.retry(id(9),signal));assert.equal(x.calls.length,1);
 x.clear();await x.review.retry(post,signal);assert.deepEqual(x.calls[0],x.calls[1]);assert.equal((await x.review.pending(signal)).pending,false);
 const y=fixture();y.unknown();await assert.rejects(y.review.retry(post,signal));await assert.rejects(y.review.submit(post,5,[b,a],signal));assert.equal(y.calls.length,0);
});
