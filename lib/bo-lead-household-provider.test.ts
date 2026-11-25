import {test} from "node:test";
import assert from "node:assert/strict";
import {LeadApiError,type LeadDetail,type LeadMember} from "./bo-lead-household-client";
import {LeadCommandFence,memberInput,presentLeadDetail,presentLeadRow} from "../app/bo/sales/leads/lead-household-provider";
const id="01a03c6e-cc58-7d81-ac8e-123456789abc",child="01a03c6e-cc58-7d81-ac8e-123456789abd";
const member:LeadMember={id:child,status:"ACTIVE",version:1,displayName:"Synthetic",intendedRoles:["PARENT","GUEST"],gender:null,birthPrecision:"YEAR",birthYear:2018,birthMonth:null,birthDay:null,reportedAge:null,ageObservedAt:null,interestKinds:["MYTIME_PIANO"]};
function detail(version=2):LeadDetail{return {id,phone:"0900000000",contactDisplayName:null,status:"ACTIVE",primaryContactMemberId:null,version,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:01:00Z",createdBy:null,updatedBy:null,centerId:null,memberCount:1,intentCount:1,members:[member],relationships:[],intents:[{id:child,kind:"PROGRAM_INTEREST",sourceBrand:"PINO_HOUSE",sourceSurface:"PINO_HOUSE_WEB",status:"SUBMITTED",createdAt:"2026-11-25T00:00:00Z",version:1}],intentHistoryHasMore:false};}
test("PAP-2288 real DTO preserves nullable contact, counts, roles, partial DOB and separate history",()=>{
 const d=detail(),p=presentLeadDetail(d);
 assert.equal(p.contactName,null);assert.equal(p.memberCount,1);assert.deepEqual(p.interestKinds,["MYTIME_PIANO"]);assert.equal(p.intents.length,1);assert.equal(p.intents[0]?.kind,"PROGRAM_INTEREST");assert.equal(p.members[0]?.primaryContact,false);assert.deepEqual(p.members[0]?.intendedRoles,["PARENT","GUEST"]);assert.equal(p.members[0]?.birthPrecision,"YEAR");assert.equal(p.members[0]?.birthDay,null);
 assert.equal(presentLeadRow(d).intentCount,1);
 const input=memberInput(member,{displayName:"Changed"});assert.equal(input.birthYear,2018);assert.equal(input.birthDay,null);assert.equal("ageObservedAt" in input,false);assert.deepEqual(input.intendedRoles,member.intendedRoles);
});
test("PAP-2288 network uncertainty fences new writes and exact explicit retry",async()=>{
 const keys:string[]=[];let calls=0;const fence=new LeadCommandFence({detail:()=>Promise.resolve(detail())},()=>"synthetic-key");
 const invoke=(key:string)=>{keys.push(key);calls++;return calls===1?Promise.reject(new TypeError("network")):calls===2?Promise.reject(new LeadApiError(409,"CONFLICT",null)):Promise.resolve({leadId:id,version:2});};
 await assert.rejects(fence.submit(id,invoke));assert.equal(fence.state,"uncertain");
 await assert.rejects(fence.submit(id,invoke),LeadApiError);assert.equal(keys.length,1);
 await assert.rejects(fence.retry(),LeadApiError);assert.equal(fence.state,"uncertain");
 assert.equal((await fence.retry()).version,2);assert.deepEqual(keys,["synthetic-key","synthetic-key","synthetic-key"]);assert.equal(fence.state,"idle");
});
test("PAP-2288 receipt readback failure cannot resubmit; reload verifies version",async()=>{
 let reads=0,writes=0;const fence=new LeadCommandFence({detail:()=>{reads++;return Promise.resolve(detail(reads===1?1:2));}},()=>"key");
 const invoke=()=>{writes++;return Promise.resolve({leadId:id,version:2});};
 await assert.rejects(fence.submit(id,invoke),LeadApiError);assert.equal(fence.state,"reload_required");
 await assert.rejects(fence.retry(),LeadApiError);await assert.rejects(fence.submit(id,invoke),LeadApiError);
 assert.equal((await fence.reload(id)).version,2);assert.equal(writes,1);assert.equal(fence.state,"idle");
});
test("PAP-2288 conflict requires reload before fresh key; simultaneous command denied",async()=>{
 let finish:(value:{leadId:string;version:number})=>void=()=>{};
 const fence=new LeadCommandFence({detail:()=>Promise.resolve(detail())},()=>"key");
 const first=fence.submit(id,()=>new Promise(resolve=>{finish=resolve;}));
 await assert.rejects(fence.submit(id,()=>Promise.resolve({leadId:id,version:2})),LeadApiError);finish({leadId:id,version:2});await first;
 await assert.rejects(fence.submit(id,()=>Promise.reject(new LeadApiError(409,"CONFLICT",null))),LeadApiError);
 assert.equal(fence.state,"conflict");await assert.rejects(fence.retry(),LeadApiError);await fence.reload(id);assert.equal(fence.state,"idle");
});
