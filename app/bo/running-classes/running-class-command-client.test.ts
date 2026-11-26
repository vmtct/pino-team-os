import test from "node:test";
import assert from "node:assert/strict";
import {prepareClassCreate,createRunningClassCommandClient} from "./running-class-command-client";
import type {ClassCreate} from "./running-class-draft";
const id=(n:number)=>"01234567-89ab-7abc-8def-"+String(n).padStart(12,"0");
const center=id(1),other=id(9);
const command:ClassCreate={centerId:center,pathProgramId:id(2),learningSpaceId:id(3),operationalName:"Piano",weekdayIso:1,windowStartsLocal:"18:00",windowEndsLocal:"19:30",deliveryTopology:"FIXED_COHORT",optimalConcurrentCapacity:8,hardConcurrentCapacity:null,defaultParticipationMinutes:null,status:"INACTIVE"};
const row={...command,id:id(4),version:1};
function mock(replies:{status:number;data:unknown}[]){
 const calls:{url:string;init?:RequestInit}[]=[];
 const fetcher=(async(input:RequestInfo|URL,init?:RequestInit)=>{calls.push({url:String(input),init});const r=replies.shift();if(!r)throw Error("unexpected call");return Response.json({data:r.data},{status:r.status});}) as typeof fetch;
 return {calls,client:createRunningClassCommandClient(center,fetcher)};
}
const read=(r:unknown)=>({status:200,data:{centers:[{id:center}],runningClasses:[r]}});
test("create uses exact inactive path and frozen caller key, verifies scoped receipt",async()=>{
 const a=prepareClassCreate(center,command,"original-key");
 const m=mock([{status:201,data:row},read(row)]);
 assert.equal(Object.isFrozen(a),true);
 assert.deepEqual(await m.client.create(a),row);
 assert.equal(m.calls[0]?.url,"/api/bo/delivery/running-classes/create-inactive?centerId="+center);
 assert.equal(m.calls[0]?.init?.body,a.body);
 assert.equal(new Headers(m.calls[0]?.init?.headers).get("idempotency-key"),a.key);
 assert.equal(m.calls[1]?.url,"/api/bo/delivery/bootstrap-state?centerId="+center);
});
test("rejects fixtures, foreign Center, wrong receipt and missing readback without automatic retry",async()=>{
 assert.throws(()=>prepareClassCreate(center,{...command,centerId:other},"k"));
 assert.throws(()=>prepareClassCreate(center,{...command,learningSpaceId:"RC-MOCK-ROOM"},"k"));
 const a=prepareClassCreate(center,command,"k");
 const m=mock([{status:201,data:{...row,status:"ACTIVE"}}]);
 await assert.rejects(m.client.create(a),/receipt mismatch/);
 assert.equal(m.calls.length,1);
 const n=mock([{status:201,data:row},read({...row,version:2})]);
 await assert.rejects(n.client.create(a),/receipt mismatch/);
 assert.equal(n.calls.length,2);
});
test("inline sends only approved fields and expected version, verifies v+1 exact readback",async()=>{
 const next={...row,operationalName:"Art",version:2};
 const m=mock([{status:200,data:next},read(next)]);
 assert.deepEqual(await m.client.edit(row,{id:row.id,expectedVersion:1,changes:{operationalName:"Art"}}),next);
 assert.equal(m.calls[0]?.url,"/api/bo/delivery/running-classes/"+row.id+"/inline?centerId="+center);
 assert.equal(m.calls[0]?.init?.method,"PATCH");
 assert.deepEqual(JSON.parse(String(m.calls[0]?.init?.body)),{expectedVersion:1,operationalName:"Art"});
});
test("stale edit and foreign Center readback fail closed",async()=>{
 const m=mock([]);
 await assert.rejects(m.client.edit(row,{id:row.id,expectedVersion:2,changes:{operationalName:"Art"}}),/Stale/);
 assert.equal(m.calls.length,0);
 const next={...row,operationalName:"Art",version:2};
 const n=mock([{status:200,data:next},read({...next,centerId:other})]);
 await assert.rejects(n.client.edit(row,{id:row.id,expectedVersion:1,changes:{operationalName:"Art"}}));
 assert.equal(n.calls.length,2);
});
