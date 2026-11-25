// PAP-2358 · WFM-STAFF. Local synthetic lifecycle regression.
import test from "node:test";
import assert from "node:assert/strict";
import {createHoStaffCreateFlow,createHoStaffCreateState,reconcileHoStaffCreate} from "./ho-manual-staff-create-flow";
import {HoManualStaffCreateError} from "./ho-manual-staff-create-client";
import type {StaffCreateCommand} from "../app/ho/staff/manual-create-contract";
import type {HoManualStaffReceipt} from "./ho-manual-staff-create-receipt";
const cmd:StaffCreateCommand={name:"QA Staff",phone:"0912345678",email:"qa@example.invalid",gender:null,birthDate:null,centerId:"center",login:null};
const receipt:HoManualStaffReceipt={staffMemberId:"staff",personId:"person",membershipId:"member",centerId:"center",accessState:"NOT_PROVISIONED"};
test("uncertain result survives distinct client instances and reuses opaque key",async()=>{
 const state=createHoStaffCreateState(),keys:string[]=[];
 const a=createHoStaffCreateFlow(state,{makeKey:()=>"first-key",submit:async(_c,k)=>{keys.push(k);throw new HoManualStaffCreateError("uncertain",null);}});
 await assert.rejects(a(cmd),{kind:"uncertain"});
 const b=createHoStaffCreateFlow(state,{makeKey:()=>"wrong-new-key",submit:async(_c,k)=>{keys.push(k);return receipt;}});
 await assert.rejects(b({...cmd,centerId:"other"}),{kind:"different-intent"});
 assert.deepEqual(await b(cmd),receipt);assert.deepEqual(keys,["first-key","first-key"]);assert.equal(state.pending,null);
});
test("parallel submission is rejected and no second request occurs",async()=>{
 const state=createHoStaffCreateState();let finish!:(value:HoManualStaffReceipt)=>void;
 const gate=new Promise<HoManualStaffReceipt>(resolve=>{finish=resolve;});
 let calls=0;const submit=async()=>{calls++;return gate;};
 const a=createHoStaffCreateFlow(state,{makeKey:()=>"pending-key",submit});
 const b=createHoStaffCreateFlow(state,{makeKey:()=>"another-key",submit});
 const pending=a(cmd);await assert.rejects(b(cmd),{kind:"busy"});finish(receipt);await pending;assert.equal(calls,1);
});
test("uncertain login retains no password and later conflict does not clear uncertainty",async()=>{
 const state=createHoStaffCreateState(),login={...cmd,login:{email:cmd.email,password:"synthetic-secret-password"}};
 const a=createHoStaffCreateFlow(state,{makeKey:()=>"login-key",submit:async()=>{throw new HoManualStaffCreateError("uncertain",503);}});
 await assert.rejects(a(login),{kind:"uncertain"});assert.equal(JSON.stringify(state).includes(login.login.password),false);
 const b=createHoStaffCreateFlow(state,{submit:async(_c,k)=>{assert.equal(k,"login-key");throw new HoManualStaffCreateError("conflict",409);}});
 await assert.rejects(b(login),{kind:"conflict"});assert.equal(state.pending?.phase,"uncertain");
 await assert.rejects(b(cmd),{kind:"different-intent"});
});
test("definite initial rejection releases key, next intent uses a fresh key",async()=>{
 const state=createHoStaffCreateState();let n=0;
 const flow=createHoStaffCreateFlow(state,{makeKey:()=>"key-"+ ++n,submit:async(_c,k)=>{if(k==="key-1")throw new HoManualStaffCreateError("invalid",400);return receipt;}});
 await assert.rejects(flow(cmd),{kind:"invalid"});assert.equal(state.pending,null);await flow({...cmd,name:"Corrected"});assert.equal(n,2);
});

test("explicit Person is part of retry identity and committed readback must match",async()=>{
 const state=createHoStaffCreateState(),selected={...cmd,existingPersonId:"person"};
 const flow=createHoStaffCreateFlow(state,{makeKey:()=>"selected-key",submit:async()=>{throw new HoManualStaffCreateError("uncertain",null);}});
 await assert.rejects(flow(selected),{kind:"uncertain"});
 await assert.rejects(flow({...selected,existingPersonId:"other"}),{kind:"different-intent"});
 await assert.rejects(reconcileHoStaffCreate(state,async()=>({state:"COMMITTED",receipt:{...receipt,personId:"other"}})),{kind:"uncertain"});
 assert.equal(state.pending?.existingPersonId,"person");
 assert.deepEqual(await reconcileHoStaffCreate(state,async()=>({state:"COMMITTED",receipt})),{state:"COMMITTED",receipt});
 assert.equal(state.pending,null);
});
