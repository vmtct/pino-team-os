import {test} from "node:test";
import assert from "node:assert/strict";
import {openNativeDraftSession} from "../app/bo/piner-posts/native-draft-session";
import {createSessionDraftJournal} from "../app/bo/piner-posts/draft-retry-journal";
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
  if(init?.method==="POST")return Response.json({data:{attachment:{id:I,state:"RESERVED",mimeType:"image/png",byteSize:1,version:1,postVersion:2,expiresAt:"2026-11-19T12:30:00Z"},committedPostVersion:2,committedAttachmentVersion:1,replayed:false}});
  return Response.json({data:{attachments:[],mediaCount:0,postVersion:1}});
 }};
 const s=await openNativeDraftSession(A,"centers",signal,options);assert.equal(s.canCreate(),false);assert.equal(s.canEditMedia(),true);
 const media=s.media(P);assert.equal((await media.list(signal)).mediaCount,0);assert.equal((await media.reserve(new Blob(["x"],{type:"image/png"}),1,"post-media-command-001",signal)).attachment.id,I);
 assert.equal(calls.length,2);assert(calls.every(c=>c.path.endsWith("?centerId="+A)));s.dispose();await assert.rejects(media.list(signal));assert.equal(calls.length,2);
});
test("create-only cannot reserve media even with Draft view",async()=>{
 const x=setup(["piner.post.view","piner.post.create"]),s=await openNativeDraftSession(A,"centers",signal,x.options);
 assert.equal(s.canEditMedia(),false);await assert.rejects(s.media("01900000-0000-7000-8000-000000000004").reserve(new Blob(["x"],{type:"image/png"}),1,"post-media-command-001",signal));assert(!x.calls.some(p=>p.includes("/attachments")));s.dispose();
});

test("native Media controller is retained per post and disposed with the actor session",async()=>{const x=setup(["piner.post.view"]),s=await openNativeDraftSession(A,"centers",signal,x.options),P="01900000-0000-7000-8000-000000000004";const c=s.mediaController(P);assert.equal(s.mediaController(P),c);s.dispose();await assert.rejects(c.list(signal));assert.throws(()=>s.mediaController(P));});