// PAP-2358 · WFM-STAFF. Admission seam and recovery with synthetic transports.
import test from "node:test";
import assert from "node:assert/strict";
import {createNativeStaffCommand,type StaffCreateAdmission} from "./staff-native-command";
import type {StaffCreateCommand} from "./manual-create-contract";
import {createHoStaffCreateState} from "@/lib/ho-manual-staff-create-flow";
import {HoManualStaffCreateError} from "@/lib/ho-manual-staff-create-client";
const command:StaffCreateCommand={name:"QA",phone:"0900000000",email:"qa@example.invalid",gender:null,birthDate:null,centerId:"center",login:null};
const receipt={staffMemberId:"staff",personId:"person",membershipId:"member",centerId:"center",initialStaffStatus:"inactive" as const,accessState:"NOT_PROVISIONED" as const};
test("native commands default off, login is separate and only admitted center is allowed",async()=>{
 let admission:StaffCreateAdmission|undefined,authorized=true,calls=0;
 const control=createNativeStaffCommand({verify:async()=>{},admission:()=>admission,authorized:()=>authorized,centers:()=>[{id:"center",label:"QA"}],makeKey:()=>"key",submit:async()=>{calls++;return receipt;}});
 await assert.rejects(control.create(command));admission="record-only";
 await assert.rejects(control.create({...command,login:{email:command.email,password:"synthetic-password"}}));
 await assert.rejects(control.create({...command,centerId:"foreign"}));authorized=false;
 await assert.rejects(control.create(command));assert.equal(calls,0);authorized=true;
 await control.create(command);assert.equal(calls,1);
});
test("uncertain readback retains same key until exact committed receipt",async()=>{
 let committed=false;const keys:string[]=[];
 const control=createNativeStaffCommand({verify:async()=>{},admission:()=>"record-only",authorized:()=>true,centers:()=>[{id:"center",label:"QA"}],makeKey:()=>"same-key",submit:async(_c,k)=>{keys.push(k);throw new HoManualStaffCreateError("uncertain",null);},read:async(_c,k)=>{keys.push(k);return committed?{state:"COMMITTED",receipt}:{state:"NOT_OBSERVED"};}});
 await assert.rejects(control.create(command));assert(control.pending());
 assert.equal(await control.readback(),false);assert(control.pending());
 await assert.rejects(control.create({...command,name:"other"}));committed=true;
 assert.equal(await control.readback(),true);assert(!control.pending());assert.deepEqual(keys,["same-key","same-key","same-key"]);
});

test("recreated caller keeps operation state without stale admission",async()=>{
 const state=createHoStaffCreateState();
 const base={state,authorized:()=>true,centers:()=>[{id:"center",label:"QA"}],makeKey:()=>"stable-key"};
 const first=createNativeStaffCommand({verify:async()=>{},...base,admission:()=>"record-only",submit:async()=>{throw new HoManualStaffCreateError("uncertain",null);}});
 await assert.rejects(first.create(command));assert(first.pending());
 const denied=createNativeStaffCommand({verify:async()=>{},...base,admission:()=>undefined,read:async()=>{throw Error("unexpected request");}});
 await assert.rejects(denied.readback());assert(denied.pending());
 const next=createNativeStaffCommand({verify:async()=>{},...base,admission:()=>"record-only",read:async(_c,key)=>{assert.equal(key,"stable-key");return {state:"COMMITTED",receipt};}});
 assert.equal(await next.readback(),true);assert(!next.pending());
});

test("committed receipt is retained when verification fails; no second create or receipt request",async()=>{
 const state=createHoStaffCreateState(),calls:string[]=[];let available=false,authorized=true;
 const control=createNativeStaffCommand({state,admission:()=>"record-only",authorized:()=>authorized,centers:()=>[{id:"center",label:"QA"}],makeKey:()=>"original-key",submit:async()=>{calls.push("create");return receipt;},read:async()=>{throw Error("unexpected receipt request");},verify:async r=>{assert.deepEqual(r,receipt);calls.push("verify");if(!available)throw Error("missing detail");}});
 await assert.rejects(control.create(command),/missing detail/);assert(control.committed());assert(control.pending());
 await assert.rejects(control.create(command),/readback only/);
 authorized=false;await assert.rejects(control.readback(),/not admitted/);
 authorized=true;available=true;assert.equal(await control.readback(),true);assert(!control.pending());assert(!control.committed());
 assert.deepEqual(calls,["create","verify","verify"]);
});
test("scope loss during verification preserves committed fence",async()=>{
 let admitted=true;const control=createNativeStaffCommand({admission:()=>"record-only",authorized:()=>admitted,centers:()=>[{id:"center",label:"QA"}],submit:async()=>receipt,makeKey:()=>"stable-key",verify:async()=>{admitted=false;}});
 await assert.rejects(control.create(command),/scope changed/);assert(control.committed());assert(control.pending());
 await assert.rejects(control.readback(),/not admitted/);
});

test("PAP-2395 disposed caller cannot dispatch or report NOT_OBSERVED after authority lifetime ends",async()=>{
 const controller=new AbortController();let calls=0;
 const control=createNativeStaffCommand({admission:()=>"record-only",authorized:()=>!controller.signal.aborted,centers:()=>[{id:"center",label:"QA"}],makeKey:()=>"stable-key",submit:async()=>{calls++;throw new HoManualStaffCreateError("uncertain",null);},read:async()=>{controller.abort();return {state:"NOT_OBSERVED"};},verify:async()=>{throw Error("unexpected verify");}});
 await assert.rejects(control.create(command));assert(control.pending());
 await assert.rejects(control.readback(),/scope changed/);assert(control.pending());
 await assert.rejects(control.create(command),/not admitted/);assert.equal(calls,1);
});
