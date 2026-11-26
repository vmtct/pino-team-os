import {test} from "node:test";
import assert from "node:assert/strict";
import {createNativeDiaryComposer} from "../app/bo/piner-posts/native-diary-composer";
import type {CoreDraftRow} from "../app/bo/piner-posts/core-draft-client";
import type {WorkflowCommand} from "../app/bo/piner-posts/workflow-client";
const id=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0"),center=id(1),post=id(2),diary=id(3),used=id(4),photo=id(5),attachment=id(6),path=id(7),signal=new AbortController().signal;
function setup(){
 let v=5,selected=false,linked=false,allowed=true,pending=false,lost=false;
 const calls:WorkflowCommand[]=[];
 const stamp="2026-11-25T12:00:00Z";
 const descriptor={id:photo,diaryId:diary,mimeType:"image/png",byteSize:1,confirmedAt:stamp};
 const scope=()=>({postId:post,centerId:center,version:v});
 const state=()=>({...scope(),status:"DRAFT" as const,diaryIds:selected?[diary]:[],provenance:linked?[{attachmentId:attachment,diaryId:diary,evidenceId:photo,transform:"RAW" as const,attachmentVersion:2}]:[],submittedAttachmentIds:null});
 const execute=async(c:WorkflowCommand)=>{calls.push(c);if(lost){pending=true;throw Error("Lost ACK");}pending=false;v=c.expectedVersion+1;if(c.kind==="diary-selection")selected=c.diaryIds.includes(diary);if(c.kind==="diary-provenance")linked=true;return {command:c,committedVersion:v,replayed:false};};
 const read={state:async()=>state(),submissionState:async()=>({...scope(),status:"DRAFT" as const,submittedAttachmentIds:null}),discover:async()=>({...scope(),diaries:[{diaryId:diary,registeredAt:stamp,pathId:path,runningClassId:null,claimState:selected?"SELECTED" as const:"AVAILABLE" as const},{diaryId:used,registeredAt:stamp,pathId:path,runningClassId:null,claimState:"USED" as const}],nextAfter:null}),photos:async()=>({...scope(),diaryId:diary,claimState:selected?"SELECTED" as const:"AVAILABLE" as const,photos:[descriptor]}),photo:async()=>({...descriptor,base64:"eA=="})};
 const port=createNativeDiaryComposer({centerId:center,canCompose:()=>allowed,detail:async()=>({id:post,centerId:center,version:v,status:"Nháp",programKey:"AFTERSCHOOL"} as CoreDraftRow),read,list:async()=>({postVersion:v,mediaCount:1,attachments:[{id:attachment,state:"READY",version:2,postVersion:v,mimeType:"image/png",byteSize:1,expiresAt:stamp}]}),workflow:{run:execute,retry:execute,hasPending:async()=>pending},newKey:()=>"native-diary-test-0001"});
 return {port,calls,lose:()=>{lost=true;},recover:()=>{lost=false;},deny:()=>{allowed=false;}};
}
test("PAP-2386 native Diary reads exact scope, denies used, links ready source and protects claim",async()=>{
 const x=setup();assert.equal((await x.port.load(post,signal)).diaries.length,2);
 await assert.rejects(x.port.toggle(post,used,5,signal));assert.equal(x.calls.length,0);
 const selected=await x.port.toggle(post,diary,5,signal);assert.deepEqual(selected.state.diaryIds,[diary]);
 assert.equal(await (await x.port.photo(post,diary,photo,6,signal)).text(),"x");
 const linked=await x.port.link(post,diary,photo,attachment,"RAW",6,signal);assert.equal(linked.state.provenance[0]?.attachmentId,attachment);
 await assert.rejects(x.port.toggle(post,diary,7,signal));assert.equal(x.calls.length,2);
 x.deny();await assert.rejects(x.port.load(post,signal));
});
test("PAP-2386 native Diary exact retry only, stale version and absent source denied",async()=>{
 const x=setup();await assert.rejects(x.port.toggle(post,diary,4,signal));await assert.rejects(x.port.link(post,diary,photo,attachment,"RAW",5,signal));assert.equal(x.calls.length,0);
 x.lose();await assert.rejects(x.port.toggle(post,diary,5,signal));assert.deepEqual(await x.port.pending(signal),{pending:true,retryPostId:post});
 await assert.rejects(x.port.toggle(post,diary,5,signal));await assert.rejects(x.port.retry(used,signal));x.recover();
 assert.deepEqual((await x.port.retry(post,signal)).state.diaryIds,[diary]);assert.deepEqual(x.calls[0],x.calls[1]);
});
