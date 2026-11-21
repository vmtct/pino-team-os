import {test} from "node:test";
import assert from "node:assert/strict";
import {coreDraftClient,CoreDraftRequestError} from "../app/bo/piner-posts/core-draft-client";
const A="01900000-0000-7000-8000-000000000001",P="01900000-0000-7000-8000-000000000004",PERSON="01900000-0000-7000-8000-000000000005";
const stamp="2026-11-18T00:00:00.000Z",signal=new AbortController().signal,key="draft-command-00001";
const raw=(extra:Record<string,unknown>={})=>({id:P,studentId:null,personId:PERSON,personName:"QA Person",studentName:null,programKey:"MYTIME",centerId:A,centerName:"A",caption:"",status:"DRAFT",publisher:"MyTime by PINO",version:1,createdAt:stamp,updatedAt:stamp,createdBy:null,updatedBy:"QA Actor",mediaCount:0,...extra});
const res=(data:unknown,status=200)=>Response.json({data},{status});
test("scoped Post read projects Person subject and approved fields",async()=>{
 const paths:string[]=[];const f:typeof fetch=async(input,init)=>{paths.push(String(input));assert.equal(init?.credentials,"same-origin");assert.equal(init?.cache,"no-store");assert.equal(init?.redirect,"error");return res(paths.length===1?{posts:[raw()],nextBeforeId:null}:raw());};
 const api=coreDraftClient(A,f),list=await api.list(signal);
 assert.equal(list.rows[0]?.personId,PERSON);assert.equal(list.rows[0]?.programKey,"MYTIME");assert.equal(list.rows[0]?.name,"QA Person");assert.equal(list.rows[0]?.updatedBy,"QA Actor");await api.detail(P,signal);
 assert.deepEqual(paths,["/api/bo/learning/piner-posts?centerId="+A+"&limit=50","/api/bo/learning/piner-posts/"+P+"?centerId="+A]);
});
test("Person directory query is Center/program scoped and validates its page",async()=>{
 const paths:string[]=[];const f:typeof fetch=async(input)=>{paths.push(String(input));return res({people:[{personId:PERSON,displayName:"QA Person",ageYears:30,phoneLast4:"1234",actorLabels:["GUEST"]}],nextAfter:PERSON});};
 const api=coreDraftClient(A,f),page=await api.personOptions("MYTIME",signal,"qa");
 assert.equal(page.people[0]?.personId,PERSON);assert.equal(page.nextAfter,PERSON);
 assert.equal(paths[0],"/api/bo/learning/piner-posts/people?centerId="+A+"&programKey=MYTIME&q=qa&limit=100");
 await assert.rejects(coreDraftClient(A,async()=>res({people:[{personId:PERSON,displayName:null,ageYears:131,phoneLast4:null,actorLabels:["GUEST"]}],nextAfter:null})).personOptions("MYTIME",signal));
});
test("Person ID create and caption edit forward immutable inputs and idempotency",async()=>{
 const calls:RequestInit[]=[];let post=raw();
 const f:typeof fetch=async(_input,init)=>{calls.push(init!);if(init?.method==="POST")return res({post,committedVersion:1,replayed:false},201);post=raw({version:2,caption:"edited"});return res({post,committedVersion:2,replayed:false});};
 const api=coreDraftClient(A,f);
 await api.createDraft({personId:PERSON,programKey:"MYTIME",caption:"",idempotencyKey:key},signal);
 await api.editCaption({postId:P,caption:"edited",expectedVersion:1,idempotencyKey:"edit-command-000001"},signal);
 assert.deepEqual(calls.map(c=>JSON.parse(String(c.body))),[{personId:PERSON,programKey:"MYTIME",caption:""},{caption:"edited",expectedVersion:1}]);
 assert.equal(new Headers(calls[0]?.headers).get("idempotency-key"),key);
});
test("foreign Center, invalid program, denied and aborted requests fail closed",async()=>{
 await assert.rejects(coreDraftClient(A,async()=>res(raw({centerId:"01900000-0000-7000-8000-000000000002"}))).detail(P,signal));
 await assert.rejects(coreDraftClient(A,async()=>res(raw({publisher:"PINO Afterschool"}))).detail(P,signal));
 let calls=0;const api=coreDraftClient(A,async()=>{calls++;return res({secret:"not projected"},409);});
 await assert.rejects(api.detail(P,signal),e=>e instanceof CoreDraftRequestError&&e.status===409&&!e.message.includes("secret"));
 const ctl=new AbortController();ctl.abort();await assert.rejects(api.list(ctl.signal));assert.equal(calls,1);
});