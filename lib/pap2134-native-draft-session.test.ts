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
test("session candidate uses canonical actor and verified selected center; view-only cannot create",async()=>{const x=setup(["piner.post.view"]);const s=await openNativeDraftSession(A,"centers",signal,x.options);assert.equal(s.userId,U);assert.equal(s.controller.centerId,A);assert.equal(s.canCreate(),false);await assert.rejects(s.studentChoices(signal));assert.deepEqual(x.calls,["/api/bo/context","/api/bo/centers"]);s.dispose();assert.equal(s.context.authorize("piner.post.view"),false);});
test("no preview discriminator grant, no foreign center, no production host",async()=>{const x=setup(["local.posts.preview"]);await assert.rejects(openNativeDraftSession(A,"centers",signal,x.options));const y=setup(["piner.post.view"],B);await assert.rejects(openNativeDraftSession(A,"centers",signal,y.options));const z=setup(["piner.post.view"]);await assert.rejects(openNativeDraftSession(A,"centers",signal,{...z.options,origin:"https://bo.pinohouse.art"}));assert.equal(z.calls.length,0);});
