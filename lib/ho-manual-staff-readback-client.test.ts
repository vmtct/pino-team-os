// PAP-2358 · WFM-STAFF. Synthetic readback and state tests.
import test from "node:test";
import assert from "node:assert/strict";
import {readHoManualStaffReceipt} from "./ho-manual-staff-readback-client";
import {createHoStaffCreateFlow,createHoStaffCreateState,reconcileHoStaffCreate} from "./ho-manual-staff-create-flow";
import {HoManualStaffCreateError} from "./ho-manual-staff-create-client";
import type {StaffCreateCommand} from "../app/ho/staff/manual-create-contract";
import type {HoManualStaffReceipt} from "./ho-manual-staff-create-receipt";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const cmd:StaffCreateCommand={name:"QA",phone:"0912345678",email:"qa@example.invalid",gender:null,birthDate:null,centerId:id(1),login:null};
const receipt:HoManualStaffReceipt={staffMemberId:id(2),personId:id(3),membershipId:id(4),centerId:id(1),initialStaffStatus:"inactive" as const,accessState:"NOT_PROVISIONED"};
test("readback is exact key and Center only, never sends profile or password",async()=>{
 const read=await readHoManualStaffReceipt(cmd.centerId,"operation-key",false,{fetcher:async(url,init)=>{
  assert.equal(url,"/api/ho/staff/create/receipt");assert.equal(init?.method,"POST");assert.equal(init?.cache,"no-store");
  assert.equal(new Headers(init?.headers).get("idempotency-key"),"operation-key");assert.deepEqual(JSON.parse(String(init?.body)),{centerId:cmd.centerId});
  return Response.json({data:{state:"COMMITTED",receipt}});
 }});
 assert.deepEqual(read,{state:"COMMITTED",receipt});
 await assert.rejects(readHoManualStaffReceipt(cmd.centerId,"operation-key",true,{fetcher:async()=>Response.json({data:{state:"COMMITTED",receipt}})}),{kind:"invalid"});
});
test("missing or denied readback cannot clear uncertainty; committed exact receipt can",async()=>{
 const state=createHoStaffCreateState();
 const submit=createHoStaffCreateFlow(state,{makeKey:()=>"operation-key",submit:async()=>{throw new HoManualStaffCreateError("uncertain",null);}});
 await assert.rejects(submit(cmd));
 const before=state.pending;
 await assert.rejects(reconcileHoStaffCreate(state,async()=>{throw new HoManualStaffCreateError("denied",403);}));
 assert.deepEqual(state.pending,before);
 assert.deepEqual(await reconcileHoStaffCreate(state,async(c,k,login)=>{
  assert.equal(c,cmd.centerId);assert.equal(k,"operation-key");assert.equal(login,false);return {state:"NOT_OBSERVED"};
 }),{state:"NOT_OBSERVED"});assert.deepEqual(state.pending,before);
 assert.deepEqual(await reconcileHoStaffCreate(state,async()=>({state:"COMMITTED",receipt})),{state:"COMMITTED",receipt});
 assert.equal(state.pending,null);
});
test("readback and submit share one pending fence",async()=>{
 const state=createHoStaffCreateState();
 const submit=createHoStaffCreateFlow(state,{makeKey:()=>"operation-key",submit:async()=>{throw new HoManualStaffCreateError("uncertain",null);}});
 await assert.rejects(submit(cmd));
 let done!:(value:{state:"NOT_OBSERVED"})=>void;
 const promise=reconcileHoStaffCreate(state,()=>new Promise(resolve=>{done=resolve;}));
 await assert.rejects(submit(cmd),{kind:"busy"});await assert.rejects(reconcileHoStaffCreate(state),{kind:"busy"});
 done({state:"NOT_OBSERVED"});await promise;assert.equal(state.pending?.phase,"uncertain");
});
