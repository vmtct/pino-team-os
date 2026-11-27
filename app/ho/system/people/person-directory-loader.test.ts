import {test} from "node:test";
import assert from "node:assert/strict";
import {loadPersonDirectory,personRow} from "./person-directory-loader";
import type {PersonDto} from "./person-read-client";
const id=(n:number)=>"019d2170-0000-7000-8000-"+String(n).padStart(12,"0");
function person(n:number):PersonDto{return {id:id(n),displayName:null,roles:[],avatar:{id:null,status:"SELF_MISSING",selfStatus:null,nickname:null},createdAt:"2026-11-18T12:00:00Z",updatedAt:"2026-11-18T12:00:00Z",createdBy:null,updatedBy:null,version:1};}
test("PAP-2180 complete cursor traversal and separate diagnostic counts",async()=>{
 const calls:(string|null)[]=[];const signal=new AbortController().signal;
 const result=await loadPersonDirectory({page:async(q,after,s)=>{assert.equal(q,"");assert.equal(s,signal);calls.push(after??null);return after?{items:[person(2)],nextAfter:null}:{items:[person(1)],nextAfter:id(1)};},unlinkedCounts:async()=>({students:3,staff:2,parents:1})},signal);
 assert.deepEqual(calls,[null,id(1)]);assert.deepEqual(result.rows.map(r=>r.id),[id(1),id(2)]);assert.equal(result.rows[0]?.name,id(1));assert.deepEqual(result.counts,{students:3,staff:2,parents:1});
});
test("PAP-2180 abort, failure and stalled cursor cannot return partial rows",async()=>{
 const controller=new AbortController();
 await assert.rejects(loadPersonDirectory({page:async()=>{controller.abort();return {items:[person(1)],nextAfter:id(1)};},unlinkedCounts:async()=>({students:0,staff:0})},controller.signal),{name:"AbortError"});
 const signal=new AbortController().signal;
 await assert.rejects(loadPersonDirectory({page:async()=>({items:[person(1)],nextAfter:id(1)}),unlinkedCounts:async()=>({students:0,staff:0})},signal),/Invalid directory traversal/);
 await assert.rejects(loadPersonDirectory({page:async()=>({items:[person(1)],nextAfter:null}),unlinkedCounts:async()=>{throw Error("denied");}},signal),/denied/);
});
test("PAP-2180 explicit multi-role label mapping includes Parent without inference",()=>{
 const row=personRow({...person(1),displayName:"QA",roles:[{kind:"STAFF",id:id(3),displayName:"QA staff",status:"ACTIVE"},{kind:"PARENT",id:id(4),displayName:"QA Parent",status:"ACTIVE"},{kind:"GUEST",id:id(5),displayName:null,status:null}]});
 assert.deepEqual(row.roles,["Staff","Parent","MyTime Guest"]);assert.equal(row.staff,"QA staff");assert.equal(row.guest,id(5));assert.equal(row.parent,"QA Parent");assert.equal(row.identityState,"Linked");
 assert.equal(personRow(person(6)).parent,null);
});
