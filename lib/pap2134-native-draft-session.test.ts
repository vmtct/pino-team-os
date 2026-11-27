import {test} from "node:test";
import assert from "node:assert/strict";
import {openNativeDraftSession} from "../app/bo/piner-posts/native-draft-session";
import {draftDigest,createSessionDraftJournal} from "../app/bo/piner-posts/draft-retry-journal";
const A="01900000-0000-7000-8000-000000000001",B="01900000-0000-7000-8000-000000000002",U="01900000-0000-7000-8000-000000000003";
const origin="https://bo.staging.pinohouse.art",signal=new AbortController().signal;
function setup(grants:string[],center=A){
 const map=new Map<string,string>(),calls:string[]=[];
 const journal=createSessionDraftJournal({getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);},removeItem:k=>{map.delete(k);}});
 const fetcher:typeof fetch=async input=>{const path=new URL(String(input)).pathname;calls.push(path);if(path==="/api/bo/context")return Response.json({data:{surface:"BO",entitled:true,userId:U,permissionKeys:["team.bo.access",...grants]}});if(path==="/api/bo/centers")return Response.json({data:[{id:center}]});throw Error("unexpected live operation");};
 return {calls,options:{origin,fetcher,journal}};
}
test("session candidate uses canonical actor and verified selected center; view-only cannot create",async()=>{const x=setup(["piner.post.view"]);const s=await openNativeDraftSession(A,"centers",signal,x.options);assert.equal(s.userId,U);assert.equal(s.controller.centerId,A);assert.equal(s.canCreate(),false);await assert.rejects(s.personChoices("AFTERSCHOOL",signal));assert.deepEqual(x.calls,["/api/bo/context","/api/bo/centers"]);s.dispose();assert.equal(s.context.authorize("piner.post.view"),false);});
test("no preview discriminator grant, no foreign center, no production host",async()=>{const x=setup(["local.posts.preview"]);await assert.rejects(openNativeDraftSession(A,"centers",signal,x.options));const y=setup(["piner.post.view"],B);await assert.rejects(openNativeDraftSession(A,"centers",signal,y.options));const z=setup(["piner.post.view"]);await assert.rejects(openNativeDraftSession(A,"centers",signal,{...z.options,origin:"https://bo.pinohouse.art"}));assert.equal(z.calls.length,0);});

test("native Media read and edit use exact selected actor, not create capability",async()=>{
 const x=setup(["piner.post.view","piner.post.edit"]),P="01900000-0000-7000-8000-000000000004",I="01900000-0000-7000-8000-000000000005";
 const calls:{method:string;path:string}[]=[];const options={...x.options,fetcher:async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input));if(!url.pathname.includes("/attachments"))return x.options.fetcher(input,init);
  calls.push({method:init?.method??"GET",path:url.pathname+url.search});
  const item={id:I,state:"READY",mimeType:"image/png",byteSize:1,version:2,postVersion:3,expiresAt:"2026-11-19T12:30:00Z"};
  if(init?.method==="POST"&&url.pathname.endsWith("/confirm"))return Response.json({data:{attachment:item,committedPostVersion:3,committedAttachmentVersion:2,replayed:false}});
  if(init?.method==="POST")return Response.json({data:{attachment:{...item,state:"RESERVED",version:1,postVersion:2},committedPostVersion:2,committedAttachmentVersion:1,replayed:false}});
  if(calls.length>=4)return Response.json({data:{attachments:[item],mediaCount:1,postVersion:3}});
  return Response.json({data:{attachments:[],mediaCount:0,postVersion:1}});
 }};
 const s=await openNativeDraftSession(A,"centers",signal,options);assert.equal(s.canCreate(),false);assert.equal(s.canEditMedia(),true);
 const media=s.mediaController(P);assert.equal((await media.list(signal)).mediaCount,0);assert.equal((await media.upload(new Blob(["x"],{type:"image/png"}),signal)).attachments[0]?.id,I);
 assert.equal(calls.length,4);assert(calls.every(c=>c.path.endsWith("?centerId="+A)));s.dispose();await assert.rejects(media.list(signal));assert.equal(calls.length,4);
});
test("create-only cannot reserve media even with Draft view",async()=>{
 const x=setup(["piner.post.view","piner.post.create"]),s=await openNativeDraftSession(A,"centers",signal,x.options);
 assert.equal(s.canEditMedia(),false);await assert.rejects(s.mediaController("01900000-0000-7000-8000-000000000004").upload(new Blob(["x"],{type:"image/png"}),signal));assert(!x.calls.some(p=>p.includes("/attachments")));s.dispose();
});

test("native Media controller is retained per post and disposed with the actor session",async()=>{const x=setup(["piner.post.view"]),s=await openNativeDraftSession(A,"centers",signal,x.options),P="01900000-0000-7000-8000-000000000004";const c=s.mediaController(P);assert.equal(s.mediaController(P),c);s.dispose();await assert.rejects(c.list(signal));assert.throws(()=>s.mediaController(P));});
test("PAP-2386 native workflow capabilities remain distinct and rechecked after reads",async()=>{
 const P="01900000-0000-7000-8000-000000000004",I="01900000-0000-7000-8000-000000000005";
 const grants=["piner.post.view","piner.post.diary.compose"],x=setup(grants);
 const calls:string[]=[];
 let revoke=false;
 const options={...x.options,fetcher:async(input:RequestInfo|URL,init?:RequestInit)=>{
  const path=new URL(String(input)).pathname;
  if(!path.includes("/piner-posts/"))return x.options.fetcher(input,init);
  calls.push(path);
  if(revoke)grants.splice(grants.indexOf("piner.post.diary.compose"),1);
  return Response.json({data:{postId:P,centerId:A,version:1,status:"DRAFT",diaryIds:[],provenance:[],submittedAttachmentIds:null}});
 }};
 const s=await openNativeDraftSession(A,"centers",signal,options);
 assert.equal(s.canCompose(),true);assert.equal(s.canSubmit(),false);
 assert.equal((await s.workflowRead.state(P,signal)).version,1);
 await assert.rejects(s.workflow.run({kind:"submit",postId:P,attachmentIds:[I],expectedVersion:1,idempotencyKey:"workflow-test-0001"},signal));
 assert.equal(calls.length,1);
 revoke=true;await assert.rejects(s.workflowRead.state(P,signal));assert.equal(s.canCompose(),false);
 s.dispose();await assert.rejects(s.workflowRead.state(P,signal));
 assert.equal(calls.length,2);
});
test("PAP-2386 submit-only native session cannot compose and does not need create/edit",async()=>{
 const P="01900000-0000-7000-8000-000000000004",I="01900000-0000-7000-8000-000000000005";
 const x=setup(["piner.post.view","piner.post.submit"]),calls:string[]=[];
 const s=await openNativeDraftSession(A,"centers",signal,{...x.options,fetcher:async(input,init)=>{
  const path=new URL(String(input)).pathname;if(!path.includes("/piner-posts/"))return x.options.fetcher(input,init);
  calls.push(path);
  if(path.endsWith("/submission-state"))return Response.json({data:{postId:P,centerId:A,status:"PENDING_APPROVAL",version:2,submittedAttachmentIds:[I]}});
  return Response.json({data:{post:{id:P,centerId:A,status:"PENDING_APPROVAL",version:2},committedVersion:2,replayed:false}});
 }});
 assert.equal(s.canSubmit(),true);assert.equal(s.canCompose(),false);assert.equal(s.canCreate(),false);assert.equal(s.canEditMedia(),false);
 await assert.rejects(s.workflowRead.state(P,signal));
 const receipt=await s.workflow.run({kind:"submit",postId:P,attachmentIds:[I],expectedVersion:1,idempotencyKey:"workflow-test-0002"},signal);
 assert.equal(receipt.committedVersion,2);
 assert.equal(await s.workflow.hasPending(signal),false);
 assert.deepEqual((await s.workflowRead.submissionState(P,signal)).submittedAttachmentIds,[I]);
 assert.deepEqual(calls,["/api/bo/learning/piner-posts/"+P+"/submit","/api/bo/learning/piner-posts/"+P+"/submission-state","/api/bo/learning/piner-posts/"+P+"/submission-state"]);s.dispose();
});

test("PAP-2386 native coordinator retains uncertain ordered submission until exact readback",async()=>{
 const P="01900000-0000-7000-8000-000000000004",I="01900000-0000-7000-8000-000000000005",J="01900000-0000-7000-8000-000000000006";
 const x=setup(["piner.post.view","piner.post.submit","piner.post.edit"]),calls:string[]=[];
 let correct=false;
 const s=await openNativeDraftSession(A,"centers",signal,{...x.options,fetcher:async(input,init)=>{
  const path=new URL(String(input)).pathname;
  if(!path.includes("/piner-posts/"))return x.options.fetcher(input,init);
  calls.push(path);
  if(path.endsWith("/submission-state"))return Response.json({data:{postId:P,centerId:A,status:"PENDING_APPROVAL",version:2,submittedAttachmentIds:correct?[I,J]:[J,I]}});
  return Response.json({data:{post:{id:P,centerId:A,status:"PENDING_APPROVAL",version:2},committedVersion:2,replayed:correct}});
 }});
 const command={kind:"submit" as const,postId:P,attachmentIds:[I,J],expectedVersion:1,idempotencyKey:"workflow-readback-0001"};
 await assert.rejects(s.workflow.run(command,signal));
 assert.equal(await s.workflow.hasPending(signal),true);
 await assert.rejects(s.controller.editCaption(P,1,"Changed",signal));
 await assert.rejects(s.mediaController(P).upload(new Blob(["x"],{type:"image/png"}),signal));
 await assert.rejects(s.workflow.run(command,signal));
 await assert.rejects(s.workflow.retry({...command,attachmentIds:[J,I]},signal));
 assert.equal(calls.length,2);
 correct=true;await s.workflow.retry(command,signal);
 assert.equal(await s.workflow.hasPending(signal),false);
 assert.equal(calls.length,4);s.dispose();
});

 test("PAP-2386 opaque compound marker blocks all ordinary session writes even without compose grant",async()=>{
 const x=setup(["piner.post.view","piner.post.edit","piner.post.submit","piner.post.create"]),P="01900000-0000-7000-8000-000000000004",I="01900000-0000-7000-8000-000000000005";
 const scope=await draftDigest(["pino-diary-upload-v1",U,A]);
 x.options.journal.reserve(scope,{key:"compound-test-marker-001",fingerprint:"a".repeat(64)});
 const s=await openNativeDraftSession(A,"centers",signal,x.options);
 await assert.rejects(s.controller.editCaption(P,1,"Changed",signal));
 await assert.rejects(s.controller.createDraft(I,"MYTIME","New",signal));
 await assert.rejects(s.mediaController(P).upload(new Blob(["x"],{type:"image/png"}),signal));
 await assert.rejects(s.workflow.run({kind:"submit",postId:P,attachmentIds:[I],expectedVersion:1,idempotencyKey:"workflow-test-0001"},signal));
 await assert.rejects(s.diaryUpload.retry(P,signal));
 assert(!x.calls.some(p=>p.includes("/piner-posts")));
 s.dispose();assert(x.options.journal.read(scope));
 });
 test("PAP-2386 compose/edit session reload sees unknown compound intent but cannot guess retry",async()=>{
 const x=setup(["piner.post.view","piner.post.edit","piner.post.diary.compose"]),P="01900000-0000-7000-8000-000000000004";
 const scope=await draftDigest(["pino-diary-upload-v1",U,A]);x.options.journal.reserve(scope,{key:"compound-test-marker-002",fingerprint:"b".repeat(64)});
 const s=await openNativeDraftSession(A,"centers",signal,x.options);
 assert.deepEqual(await s.diaryUpload.pending(signal),{pending:true,retryPostId:null});
 await assert.rejects(s.diaryUpload.retry(P,signal));assert(!x.calls.some(p=>p.includes("/piner-posts")));s.dispose();
 });
