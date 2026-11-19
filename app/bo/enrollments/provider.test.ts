import test from "node:test";
import assert from "node:assert/strict";
import {enrollmentProvider} from "./provider";
import {queryDefault} from "./schema";
const id=(n:number)=>"019d2181-0000-7000-8000-"+String(n).padStart(12,"0");
const centerId=id(100),scope={surface:"BO" as const,centerId},record={id:id(1),subscriptionId:id(2),studentProfileId:id(3),runningClassId:id(4),studentDisplayName:"Synthetic learner",subscriptionDisplayName:"Piano",runningClassName:"Piano",pathDisplayName:"Piano",effectiveFromLocalDate:"2026-11-01",effectiveUntilExclusiveLocalDate:null,weekdayIso:3,scheduleStartsLocal:"12:30",scheduleEndsLocal:"13:15"};
test("PAP-2181 provider rereads authorized directory for detail, removes missing relations and exposes no write",async()=>{
 const state=enrollmentProvider(),signal=new AbortController().signal;
 let reads=0;
 const fetcher:typeof fetch=async(input,init)=>{assert.equal(new URL(String(input),"https://fixture.invalid").searchParams.get("centerId"),centerId);assert.equal(init?.method,"GET");reads++;return Response.json({data:{items:reads===1?[record]:[],nextCursor:null}});};
 const list=await state.provider.list(queryDefault,scope,fetcher,signal);
 assert.equal(list.total,1);assert.equal(list.records[0]?.centerId,centerId);assert.equal(state.relation(id(1))?.subscriptionId,id(2));
 assert.equal(await state.provider.detail(id(1),scope,fetcher,signal),null);assert.equal(state.relation(id(1)),undefined);assert.equal(reads,2);
 assert.equal(state.provider.mutation,undefined);assert.equal(state.provider.history,undefined);
 await assert.rejects(()=>state.provider.list(queryDefault,{surface:"HO"},fetcher,signal));assert.equal(reads,2);
 state.dispose();
});
test("PAP-2181 detail refuses denied reread and aborted result",async()=>{
 const state=enrollmentProvider();
 await assert.rejects(()=>state.provider.detail(id(1),scope,async()=>new Response(null,{status:403}),new AbortController().signal));
 const ctl=new AbortController();ctl.abort();
 await assert.rejects(()=>state.provider.detail(id(1),scope,async()=>{throw Error("Unexpected request");},ctl.signal),{name:"AbortError"});
 state.dispose();
});
