import test from "node:test";
import assert from "node:assert/strict";
import {createRunningClassCommandClient} from "./running-class-command-client";
import {createRunningClassRecovery,runningClassJournalScope} from "./running-class-recovery";
import type {ClassCreate} from "./running-class-draft";
const id=(n:number)=>"01234567-89ab-7abc-8def-"+String(n).padStart(12,"0");
const center=id(1);
const command:ClassCreate={centerId:center,pathProgramId:id(2),learningSpaceId:id(3),operationalName:"Piano",weekdayIso:1,windowStartsLocal:"18:00",windowEndsLocal:"19:30",deliveryTopology:"FIXED_COHORT",optimalConcurrentCapacity:8,hardConcurrentCapacity:null,defaultParticipationMinutes:null,status:"INACTIVE"};
const row={...command,id:id(4),version:1};
const next={...row,operationalName:"Art",version:2};
const read=(r:unknown)=>Response.json({data:{centers:[{id:center}],runningClasses:[r]}});
const ok=(r:unknown,status=201)=>Response.json({data:r},{status});
const denial=()=>Response.json({error:{code:"CONFLICT",message:"Conflict"}},{status:409});
async function setup(){
 const map=new Map<string,string>(),calls:{url:string;init?:RequestInit}[]=[],replies:(Response|Error)[]=[];
 const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{calls.push({url:String(input),init});const r=replies.shift();if(!r||r instanceof Error)throw r??Error("unexpected request");return r;}) as typeof fetch;
 const scope=await runningClassJournalScope(id(8),center);
 const make=()=>createRunningClassRecovery({centerId:center,scope,storage,verify:async()=>{},client:createRunningClassCommandClient(center,fetcher),newKey:()=>"original-key"});
 return {map,calls,replies,make,controller:make()};
}
test("lost create ACK: original key/body only; competing command blocked; explicit retry verifies",async()=>{
 const m=await setup();m.replies.push(Error("lost ACK"));await assert.rejects(m.controller.create(command));assert.equal(m.controller.state().recovery,"SAME_CREATE");
 await assert.rejects(m.controller.create({...command,operationalName:"other"}));assert.equal(m.calls.length,1);
 m.replies.push(ok(row),read(row));assert.deepEqual(await m.controller.retry(),row);
 assert.equal(m.calls[0]?.init?.body,m.calls[1]?.init?.body);
 assert.equal(new Headers(m.calls[1]?.init?.headers).get("idempotency-key"),"original-key");assert.equal(m.map.size,0);
});
test("known receipt and lost readback: retry only GET",async()=>{
 const m=await setup();m.replies.push(ok(row),Error("network"));await assert.rejects(m.controller.create(command));
 assert.equal(m.controller.state().recovery,"READBACK");
 m.replies.push(read(row));assert.deepEqual(await m.controller.retry(),row);assert.equal(m.calls.filter(c=>c.init?.method==="POST").length,1);
});
test("unknown inline ACK never retries write, reload retains only opaque marker",async()=>{
 const m=await setup();m.replies.push(Error("unknown"));
 await assert.rejects(m.controller.edit(row,{id:row.id,expectedVersion:1,changes:{operationalName:"Art"}}));
 await assert.rejects(m.controller.retry(),/no write retry/);assert.equal(m.calls.length,1);
 assert.ok([...m.map].every(([k,v])=>!k.includes(center)&&!v.includes("Piano")));
 m.controller.dispose();const reload=m.make();await assert.rejects(reload.create(command));await assert.rejects(reload.retry());assert.equal(m.calls.length,1);
});
test("initial definitive 409 clears intent; uncertain replay 409 does not",async()=>{
 const m=await setup();m.replies.push(denial());await assert.rejects(m.controller.create(command));assert.equal(m.map.size,0);
 m.replies.push(Error("lost"));await assert.rejects(m.controller.create(command));m.replies.push(denial());await assert.rejects(m.controller.retry());assert.equal(m.map.size,1);
});
test("server audit fields change without false mismatch; inline confirmed receipt readback recovery",async()=>{
 const m=await setup(),original={...row,updatedAt:"old"},updated={...next,updatedAt:"new"};
 m.replies.push(ok(updated,200),Error("readback lost"));
 await assert.rejects(m.controller.edit(original,{id:row.id,expectedVersion:1,changes:{operationalName:"Art"}}));assert.equal(m.controller.state().recovery,"READBACK");
 m.replies.push(read(updated));assert.deepEqual(await m.controller.retry(),updated);
 assert.equal(m.calls.filter(c=>c.init?.method==="PATCH").length,1);
});
