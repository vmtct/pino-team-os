import {test} from "node:test";
import assert from "node:assert/strict";
import {postWorkflowReadClient} from "../app/bo/piner-posts/workflow-read-client";
const id=(n:number)=>"01800000-0000-7000-8000-"+String(n).padStart(12,"0");
const center=id(1),post=id(2),diary=id(3),attachment=id(4),evidence=id(5),path=id(6),signal=new AbortController().signal;
const scope={postId:post,centerId:center,version:7};
const state={...scope,status:"PENDING_APPROVAL",diaryIds:[diary],provenance:[{attachmentId:attachment,diaryId:diary,evidenceId:evidence,transform:"RAW",attachmentVersion:2}],submittedAttachmentIds:[attachment]};
const image={id:evidence,diaryId:diary,mimeType:"image/png",byteSize:1,confirmedAt:"2026-11-25T04:00:00Z",base64:"eA=="};
test("PAP-2386 exact PAP-2390 read DTOs and private same-origin transport",async()=>{
 const replies=[state,{...scope,diaries:[{diaryId:diary,pathId:path,runningClassId:null,registeredAt:image.confirmedAt,claimState:"SELECTED"}],nextAfter:diary},{...scope,diaryId:diary,claimState:"SELECTED",photos:[image]},image];
 const calls:string[]=[];
 const client=postWorkflowReadClient(center,async(input,init)=>{calls.push(String(input));assert.equal(init?.method,"GET");assert.equal(init?.credentials,"same-origin");assert.equal(init?.cache,"no-store");assert.equal(init?.redirect,"error");return Response.json({data:replies.shift()});});
 assert.deepEqual(await client.state(post,signal),state);
 assert.equal((await client.discover(post,signal,{limit:1})).nextAfter,diary);
 assert.equal((await client.photos(post,diary,signal)).photos[0]?.id,evidence);
 assert.deepEqual(await client.photo(post,diary,evidence,signal),image);
 assert(calls.every(c=>c.startsWith("/api/bo/learning/piner-posts/"+post+"/")&&c.includes("centerId="+center)));
});
test("PAP-2386 deny wrong scope, unclaimed provenance, invalid order and wrong evidence",async()=>{
 for(const data of [{...state,centerId:id(9)},{...state,diaryIds:[]},{...state,submittedAttachmentIds:[]},{...state,submittedAttachmentIds:[id(9)]}]){
  const c=postWorkflowReadClient(center,async()=>Response.json({data}));await assert.rejects(c.state(post,signal));
 }
 const c=postWorkflowReadClient(center,async()=>Response.json({data:{...image,id:id(9)}}));await assert.rejects(c.photo(post,diary,evidence,signal));
});
