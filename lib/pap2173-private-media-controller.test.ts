import {test} from "node:test";
import assert from "node:assert/strict";
import {createPrivateMediaController,readVerifiedMediaRecord,DefinitiveMediaUploadRejection} from "../app/bo/piner-posts/private-media-controller";
import {privatePostMediaClient} from "../app/bo/piner-posts/private-media-client";
const C="01900000-0000-7000-8000-000000000001",P="01900000-0000-7000-8000-000000000002",A="01900000-0000-7000-8000-000000000003",signal=new AbortController().signal;
const file=new Blob(["abc"],{type:"image/png"}),base={id:A,mimeType:"image/png",byteSize:3,expiresAt:"2026-11-19T13:00:00Z"};
function setup(){
 let version=1,state="NONE",loseConfirm=true,write=true,keyNo=0;const calls:{path:string;key:string|null;version:string|null}[]=[],revoked:string[]=[];
 const api=privatePostMediaClient(C,P,async(input,init)=>{
  const path=String(input).split("?")[0]!,headers=new Headers(init?.headers);
  if(init?.method==="POST"){
   calls.push({path,key:headers.get("idempotency-key"),version:headers.get("x-pino-post-version")});
   if(path.endsWith("/confirm")){state="READY";version=3;if(loseConfirm){loseConfirm=false;throw Error("lost response");}return Response.json({data:{attachment:{...base,state,version:2,postVersion:3},committedPostVersion:3,committedAttachmentVersion:2,replayed:true}});}
   if(path.endsWith("/revoke")){state="REVOKED";version=4;return Response.json({data:{attachment:{...base,state,version:3,postVersion:4},committedPostVersion:4,committedAttachmentVersion:3,replayed:false}});}
   state="RESERVED";version=2;return Response.json({data:{attachment:{...base,state,version:1,postVersion:2},committedPostVersion:2,committedAttachmentVersion:1,replayed:false}});
  }
  if(path.endsWith("/preview"))return new Response("abc",{headers:{"content-type":"image/png","content-length":"3"}});
  return Response.json({data:{postVersion:version,mediaCount:state==="READY"?1:0,attachments:state==="READY"?[{...base,state,version:2,postVersion:3}]:[]}});
 });
 const c=createPrivateMediaController(api,w=>!w||write,()=>"media-command-"+String(++keyNo).padStart(6,"0"),{createObjectURL:()=>"blob:qa",revokeObjectURL:u=>{revoked.push(u);}});
 return {c,calls,revoked,deny:()=>{write=false;}};
}
test("ambiguous confirm retries exact command, never reserves again; revoke verified by fresh list",async()=>{const x=setup();await x.c.list(signal);await assert.rejects(x.c.upload(file,signal));assert(x.c.hasPending());assert.equal(x.c.lastUploadReceipt(),null);await assert.rejects(x.c.upload(file,signal));assert.equal((await x.c.retry(signal)).mediaCount,1);assert.equal(x.calls.length,3);assert.deepEqual(x.calls[1],x.calls[2]);assert(!x.c.hasPending());assert.deepEqual(x.c.lastUploadReceipt(),{attachmentId:A,attachmentVersion:2,postVersion:3});assert.equal((await x.c.openPreview(A,signal)).url,"blob:qa");assert.equal((await x.c.remove(A,signal)).mediaCount,0);assert.equal(x.c.lastUploadReceipt(),null);assert.deepEqual(x.revoked,["blob:qa"]);x.c.dispose();});
test("permission loss denies pending replay and does not issue new command",async()=>{const x=setup();await x.c.list(signal);await assert.rejects(x.c.upload(file,signal));x.deny();await assert.rejects(x.c.retry(signal));assert.equal(x.calls.length,2);x.c.dispose();await assert.rejects(x.c.list(signal));});

test("Media readback uses complete canonical parent, never overlays version on old caption",async()=>{
 const list={postVersion:3,mediaCount:1,attachments:[]},row={id:P,version:4,mediaCount:2,caption:"newer caption"};
 assert.equal(await readVerifiedMediaRecord(list,P,async()=>row,signal),row);
 for(const bad of [{...row,id:A},{...row,version:2},{...row,version:3,mediaCount:0}])await assert.rejects(readVerifiedMediaRecord(list,P,async()=>bad,signal));
 const ctl=new AbortController();await assert.rejects(readVerifiedMediaRecord(list,P,async()=>{ctl.abort();return row;},ctl.signal));
});

test("expired reservation reconciles only through exact original reserve receipt after confirm conflict",async()=>{
 let version=1,reserveCalls=0,confirmCalls=0,expired=false,keyNo=0;
 const keys:string[]=[];
 const api=privatePostMediaClient(C,P,async(input,init)=>{
  const path=String(input).split("?")[0]!,h=new Headers(init?.headers);
  if(init?.method==="POST"){
   if(path.endsWith("/confirm")){confirmCalls++;return Response.json({error:{code:"CONFLICT"}},{status:409});}
   keys.push(h.get("idempotency-key")+":"+h.get("x-pino-post-version"));reserveCalls++;version=expired?3:2;
   return Response.json({data:{attachment:{...base,state:expired?"REVOKED":"RESERVED",version:expired?2:1,postVersion:version},committedPostVersion:2,committedAttachmentVersion:1,replayed:reserveCalls>1}});
  }
  return Response.json({data:{postVersion:version,mediaCount:0,attachments:[]}});
 });
 const c=createPrivateMediaController(api,()=>true,()=>"media-command-"+String(++keyNo).padStart(6,"0"));
 await c.list(signal);await assert.rejects(c.upload(file,signal));assert(c.hasPending());assert.equal(reserveCalls,2);
 expired=true;assert.equal((await c.retry(signal)).postVersion,3);assert(!c.hasPending());assert.equal(c.lastUploadReceipt(),null);assert.equal(confirmCalls,2);assert.equal(reserveCalls,3);assert.equal(new Set(keys).size,1);
 c.dispose();
});
test("preview closed while response in-flight never creates a blob URL",async()=>{
 let release!:()=>void,created=0;
 const api=privatePostMediaClient(C,P,async input=>{
  if(String(input).includes("/preview")){await new Promise<void>(r=>{release=r;});return new Response("abc",{headers:{"content-type":"image/png","content-length":"3"}});}
  return Response.json({data:{postVersion:3,mediaCount:1,attachments:[{...base,state:"READY",version:2,postVersion:3}]}});
 });
 const c=createPrivateMediaController(api,()=>true,undefined,{createObjectURL:()=>{created++;return "blob:qa";},revokeObjectURL:()=>{}});
 await c.list(signal);const preview=c.openPreview(A,signal);c.closePreview();release();await assert.rejects(preview);assert.equal(created,0);c.dispose();
});

test("PAP-2386 private thumbnail verifies version and current read scope",async()=>{
 const x=setup();await x.c.list(signal);await assert.rejects(x.c.upload(file,signal));await x.c.retry(signal);
 assert.equal(await (await x.c.readImage(A,3,signal)).text(),"abc");await assert.rejects(x.c.readImage(A,2,signal));
 await x.c.remove(A,signal);await assert.rejects(x.c.readImage(A,3,signal));x.c.dispose();await assert.rejects(x.c.readImage(A,4,signal));
});

test("PAP-2386 first definitive reserve rejection has explicit evidence; ambiguous transport retains pending",async()=>{
 for(const definitive of [true,false]){
  let writes=0;
  const api=privatePostMediaClient(C,P,async(_input,init)=>{
   if(init?.method==="POST"){writes++;if(definitive)return Response.json({error:{code:"PLATFORM_INVALID_INPUT"}},{status:400});throw Error("transport unknown");}
   return Response.json({data:{postVersion:1,mediaCount:0,attachments:[]}});
  });
  const c=createPrivateMediaController(api,()=>true,()=>crypto.randomUUID());await c.list(signal);
  await assert.rejects(c.upload(file,signal),e=>(e instanceof DefinitiveMediaUploadRejection)===definitive);
  assert.equal(c.hasPending(),!definitive);assert.equal(c.lastUploadReceipt(),null);assert.equal(writes,1);c.dispose();
 }
});
