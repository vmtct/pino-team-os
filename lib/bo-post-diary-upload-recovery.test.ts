import {test} from "node:test";
import assert from "node:assert/strict";
import {createDiaryUploadRecovery} from "../app/bo/piner-posts/diary-upload-recovery";
import type {createNativeDiaryComposer} from "../app/bo/piner-posts/native-diary-composer";
import {DefinitiveMediaUploadRejection,type createPrivateMediaController} from "../app/bo/piner-posts/private-media-controller";
import {createSessionDraftJournal} from "../app/bo/piner-posts/draft-retry-journal";
const signal=new AbortController().signal,stamp="2026-11-26T00:00:00Z",file=new Blob(["x"],{type:"image/png"}),input={postId:"post",diaryId:"diary",evidenceId:"photo",version:5,transform:"RETOUCHED" as const,file};
function setup(){
 let version=5,mediaPending=false,workflowPending=false,ready=false,linked=false,allowed=true,loseUpload=true,loseLink=true,wrong=false,definitive=false,ambiguous=false,failedRead=false,afterReject=false;
 const storage=new Map<string,string>(),journal=createSessionDraftJournal({getItem:k=>storage.get(k)??null,setItem:(k,v)=>{storage.set(k,v);},removeItem:k=>{storage.delete(k);}});
 const calls:string[]=[];
 const listing=()=>({postVersion:version,mediaCount:ready?1:0,attachments:ready?[{id:"uploaded",version:2,postVersion:7,state:"READY" as const,mimeType:"image/png" as const,byteSize:1,expiresAt:stamp}]:[]});
 const media:Pick<ReturnType<typeof createPrivateMediaController>,"list"|"upload"|"retry"|"hasPending"|"lastUploadReceipt">={
  list:async()=>{if(afterReject&&failedRead)throw Error("read unavailable");return listing();},upload:async()=>{calls.push("upload");if(definitive){afterReject=true;throw new DefinitiveMediaUploadRejection(400);}if(ambiguous){afterReject=true;throw Error("unknown transport");}ready=true;version=7;if(loseUpload){mediaPending=true;throw Error("lost upload ACK");}return listing();},
  retry:async()=>{calls.push("retry upload");mediaPending=false;return listing();},hasPending:()=>mediaPending,lastUploadReceipt:()=>ready&&!mediaPending?{attachmentId:wrong?"foreign":"uploaded",attachmentVersion:2,postVersion:7}:null
 };
 const snapshot=()=>({state:{postId:"post",centerId:"center",version,status:"DRAFT" as const,diaryIds:["diary"],provenance:linked?[{attachmentId:"uploaded",attachmentVersion:2,diaryId:"diary",evidenceId:"photo",transform:"RETOUCHED" as const}]:[],submittedAttachmentIds:null},diaries:[{diaryId:"diary",registeredAt:stamp,pathId:"path",runningClassId:null,claimState:"SELECTED" as const}]});
 const diary:Pick<ReturnType<typeof createNativeDiaryComposer>,"load"|"photos"|"photo"|"link"|"pending"|"retry">={
  load:async()=>snapshot(),photos:async()=>({postId:"post",centerId:"center",version,diaryId:"diary",claimState:"SELECTED",photos:[{id:"photo",diaryId:"diary",mimeType:"image/png",byteSize:1,confirmedAt:stamp}]}),photo:async()=>file,
  link:async(_p,_d,_e,id)=>{assert.equal(id,"uploaded");calls.push("link");linked=true;version=8;if(loseLink){workflowPending=true;throw Error("lost link ACK");}return snapshot();},
  pending:async()=>({pending:workflowPending,retryPostId:workflowPending?"post":null}),retry:async()=>{calls.push("retry link");workflowPending=false;return snapshot();}
 };
 const create=()=>createDiaryUploadRecovery({actorId:"actor",centerId:"center",authorize:()=>allowed,journal,media:()=>media,diary,newKey:()=>"compound-diary-test-001"});
 return {create,calls,storage,wrong:()=>{wrong=true;},deny:()=>{allowed=false;},noLoss:()=>{loseUpload=false;loseLink=false;},reject:(failRead=false)=>{definitive=true;failedRead=failRead;},unknown:()=>{ambiguous=true;},restoreRead:()=>{failedRead=false;},drift:()=>{version++;}};
}
test("PAP-2386 lost upload and link ACKs retain one source and exact attachment, never reupload",async()=>{
 const x=setup(),c=x.create();await assert.rejects(c.start(input,signal));assert.deepEqual(await c.pending(signal),{pending:true,retryPostId:"post"});
 await assert.rejects(c.start(input,signal));await assert.rejects(c.retry("other",signal));
 await assert.rejects(c.retry("post",signal));assert.deepEqual(x.calls,["upload","retry upload","link"]);
 const r=await c.retry("post",signal);assert.equal(r.state.provenance[0]?.attachmentId,"uploaded");
 assert.deepEqual(x.calls,["upload","retry upload","link","retry link"]);assert.equal(x.storage.size,0);
});
test("PAP-2386 reload unknown intent and mismatched upload receipt fail closed",async()=>{
 const x=setup(),c=x.create();await assert.rejects(c.start(input,signal));c.dispose();const reloaded=x.create();
 assert.deepEqual(await reloaded.pending(signal),{pending:true,retryPostId:null});await assert.rejects(reloaded.start(input,signal));await assert.rejects(reloaded.retry("post",signal));assert.deepEqual(x.calls,["upload"]);
 const y=setup(),d=y.create();y.noLoss();y.wrong();await assert.rejects(d.start(input,signal));assert.equal((await d.pending(signal)).pending,true);assert.deepEqual(y.calls,["upload"]);y.deny();await assert.rejects(d.retry("post",signal));
});
test("PAP-2386 uninterrupted upload and link clear only after authoritative exact provenance",async()=>{
 const x=setup();x.noLoss();const c=x.create();assert.equal((await c.start(input,signal)).state.version,8);assert.deepEqual(x.calls,["upload","link"]);assert.equal(x.storage.size,0);
});

test("PAP-2386 definitive reserve rejection clears only an unchanged authorized preimage",async()=>{
 const x=setup();x.reject();const c=x.create();await assert.rejects(c.start(input,signal),DefinitiveMediaUploadRejection);
 assert.equal(x.storage.size,0);assert.deepEqual(await c.pending(signal),{pending:false,retryPostId:null});assert.deepEqual(x.calls,["upload"]);
});
test("PAP-2386 failed readback retains definitive rejection and retries only readback",async()=>{
 const x=setup();x.reject(true);const c=x.create();await assert.rejects(c.start(input,signal));
 assert.equal(x.storage.size,1);assert.deepEqual(await c.pending(signal),{pending:true,retryPostId:"post"});
 await assert.rejects(c.retry("post",signal));x.restoreRead();
 assert.equal((await c.retry("post",signal)).state.version,5);assert.equal(x.storage.size,0);assert.deepEqual(x.calls,["upload"]);
});
test("PAP-2386 changed preimage, lost authorization or unknown transport never unlock",async()=>{
 const x=setup();x.reject(true);const c=x.create();await assert.rejects(c.start(input,signal));x.restoreRead();x.drift();
 await assert.rejects(c.retry("post",signal));assert.equal(x.storage.size,1);x.deny();await assert.rejects(c.retry("post",signal));assert.deepEqual(x.calls,["upload"]);
 const y=setup();y.unknown();const d=y.create();await assert.rejects(d.start(input,signal));await assert.rejects(d.retry("post",signal));assert.equal(y.storage.size,1);assert.deepEqual(y.calls,["upload"]);
});
