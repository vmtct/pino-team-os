import {test} from "node:test";
import assert from "node:assert/strict";
import {createPersonReader,decodePerson,decodePersonPage,decodeUnlinkedCounts,PersonReadError} from "./person-read-client";
const uid=(n:number)=>"019d2170-0000-7000-8000-"+String(n).padStart(12,"0");
const base={id:uid(1),displayName:null,roles:[],avatar:{id:null,status:"SELF_MISSING",selfStatus:null,nickname:null},createdAt:"2026-11-18T12:00:00Z",updatedAt:"2026-11-18T12:00:00Z",createdBy:null,updatedBy:null,version:1};
test("PAP-2180 explicit canonical roles only and nullable display name",()=>{
 const dto=decodePerson({...base,roles:[{kind:"STUDENT",id:uid(2),displayName:"QA Student",status:"ACTIVE"}]});
 assert.equal(dto.displayName,null);assert.equal(dto.roles.length,1);
 assert.throws(()=>decodePerson({...base,roles:[{kind:"PARENT",id:uid(3),displayName:"QA Parent",status:null}]}));
 assert.throws(()=>decodePerson({...base,avatar:{...base.avatar,status:"READY"}}));
 assert.throws(()=>decodePerson({...base,id:"legacy-id"}));
});
test("PAP-2180 strict page cursor, duplicate and diagnostic counts",()=>{
 assert.deepEqual(decodePersonPage({items:[base],nextAfter:base.id}).nextAfter,base.id);
 assert.throws(()=>decodePersonPage({items:[base,base],nextAfter:null}));
 assert.throws(()=>decodePersonPage({items:[base],nextAfter:uid(2)}));
 assert.throws(()=>decodePersonPage({items:[{...base,id:uid(2)},base],nextAfter:null}));
 assert.deepEqual(decodeUnlinkedCounts({students:0,staff:2}),{students:0,staff:2});
 assert.throws(()=>decodeUnlinkedCounts({students:-1,staff:2}));
});
test("PAP-2180 GET only, same origin, no-store, abort propagation and malformed denial",async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];const controller=new AbortController();
 const reader=createPersonReader(async(input,init)=>{calls.push({url:String(input),init});return Response.json({data:{items:[base],nextAfter:null}});});
 await reader.page("QA & Name",null,controller.signal);
 assert.equal(calls[0]?.url,"/api/ho/identity/persons?limit=100&q=QA+%26+Name");
 assert.equal(calls[0]?.init?.method,"GET");assert.equal(calls[0]?.init?.cache,"no-store");assert.equal(calls[0]?.init?.signal,controller.signal);
 await assert.rejects(reader.page("",uid(2)),/Invalid Person/);
 await assert.rejects(createPersonReader(async()=>new Response(null,{status:403})).page(),e=>e instanceof PersonReadError&&e.status===403);
 await assert.rejects(createPersonReader(async()=>Response.json({data:{...base,id:uid(2)}})).detail(base.id),/Invalid Person/);
});
