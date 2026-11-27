import {test} from "node:test";
import assert from "node:assert/strict";
import {privatePostMediaClient,POST_IMAGE_MAX} from "../app/bo/piner-posts/private-media-client";
const A="01900000-0000-7000-8000-000000000001",P="01900000-0000-7000-8000-000000000002",I="01900000-0000-7000-8000-000000000003",key="post-media-command-001",signal=new AbortController().signal;
const item={id:I,state:"READY",mimeType:"image/png",byteSize:3,version:2,postVersion:3,expiresAt:"2026-11-19T12:00:00Z",objectKey:"private"};
const res=(data:unknown)=>Response.json({data});
test("exact scoped list projects only READY data, no storage identifiers",async()=>{const api=privatePostMediaClient(A,P,async(input,init)=>{assert.equal(String(input),"/api/bo/learning/piner-posts/"+P+"/attachments?centerId="+A);assert.equal(init?.cache,"no-store");return res({attachments:[item],mediaCount:1,postVersion:3});});const result=await api.list(signal);assert.equal(result.mediaCount,1);assert(!JSON.stringify(result).includes("objectKey"));});
test("raw reserve and confirm retain exact version and caller key",async()=>{const file=new Blob(["abc"],{type:"image/png"});let index=0;const api=privatePostMediaClient(A,P,async(_input,init)=>{const h=new Headers(init?.headers);assert.equal(h.get("idempotency-key"),key);assert.equal(init?.body,file);assert.equal(h.get("x-pino-post-version"),String(index+1));index++;return res({attachment:{...item,state:index===1?"RESERVED":"READY",version:index,postVersion:index+1},committedPostVersion:index+1,committedAttachmentVersion:index,replayed:false});});assert.equal((await api.reserve(file,1,key,signal)).attachment.state,"RESERVED");assert.equal((await api.confirm(I,file,2,1,key,signal)).attachment.state,"READY");});
test("strict list and preview reject malformed or oversized response",async()=>{for(const data of [{attachments:[item,item],mediaCount:2,postVersion:3},{attachments:[{...item,state:"RESERVED"}],mediaCount:1,postVersion:3}])await assert.rejects(privatePostMediaClient(A,P,async()=>res(data)).list(signal));const preview=privatePostMediaClient(A,P,async()=>new Response("abc",{headers:{"content-type":"image/png","content-length":"3"}}));assert.equal((await preview.preview(item,signal)).size,3);await assert.rejects(privatePostMediaClient(A,P,async()=>new Response("abc",{headers:{"content-type":"image/png","content-length":String(POST_IMAGE_MAX+1)}})).preview(item,signal));});
test("invalid local input and aborted request never fetch",async()=>{let calls=0;const api=privatePostMediaClient(A,P,async()=>{calls++;return res({});});await assert.rejects(api.reserve(new Blob(["x"],{type:"text/plain"}),1,key,signal));const ctl=new AbortController();ctl.abort();await assert.rejects(api.list(ctl.signal));assert.equal(calls,0);});

test("preview verifies exact READY MIME and decoded bytes when Content-Length is omitted or encoded",async()=>{
 const attempt=(body:string,headers:Record<string,string>)=>privatePostMediaClient(A,P,async()=>new Response(body,{headers})).preview(item,signal);
 const h={"content-type":"image/png"};
 assert.equal(await (await attempt("abc",h)).text(),"abc");
 assert.equal(await (await attempt("abc",{...h,"content-encoding":"gzip","content-length":"23"})).text(),"abc");
 for(const [body,headers] of [["ab",h],["abcd",h],["",h],["abc",{...h,"content-length":"4"}],["abc",{...h,"content-length":"bad"}],["abc",{"content-type":"image/jpeg"}]] as const)await assert.rejects(attempt(body,headers));
});
