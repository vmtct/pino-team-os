// PAP-2358 · WFM-STAFF. Browser-storage contract, using synthetic values only.
import test from "node:test";
import assert from "node:assert/strict";
import {createStaffRecoveryJournal} from "./staff-recovery-journal";
import {createNativeStaffCommand,createNativeStaffOperationState,restoreNativeStaffOperation} from "./staff-native-command";
import {HoManualStaffCreateError} from "@/lib/ho-manual-staff-create-client";
import type {StaffCreateCommand} from "./manual-create-contract";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const cmd:StaffCreateCommand={name:"Synthetic QA",phone:"0900000000",email:"qa@example.invalid",gender:null,birthDate:null,centerId:id(1),existingPersonId:id(2),login:{email:"qa@example.invalid",password:"synthetic-password"}};
const receipt={staffMemberId:id(3),personId:id(2),membershipId:id(4),centerId:id(1),accessState:"PROVISIONED" as const,accessUserId:id(5),assignmentId:id(6)};
function memory(){
 const data=new Map<string,string>();
 return {data,storage:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}}};
}
const base={admission:()=>"record-and-login" as const,authorized:()=>true,centers:()=>[{id:id(1),label:"QA"}],makeKey:()=>"original-key"};
test("journal precedes request and stores no profile or credentials; reload readback only",async()=>{
 const {data,storage}=memory(),journal=createStaffRecoveryJournal(storage,id(9));
 const first=createNativeStaffCommand({...base,journal,submit:async(_c,key)=>{
  assert.equal(key,"original-key");assert.equal(journal.load()?.key,key);
  const raw=Array.from(data.values()).join("");
  for(const secret of [cmd.name,cmd.phone,cmd.email,cmd.login!.password])assert(!raw.includes(secret));
  throw new HoManualStaffCreateError("uncertain",null);
 }});
 await assert.rejects(first.create(cmd));
 const state=createNativeStaffOperationState();restoreNativeStaffOperation(state,journal);
 const second=createNativeStaffCommand({...base,state,journal,submit:async()=>{throw Error("unexpected write");},read:async(c,key,login)=>{assert.equal(c,id(1));assert.equal(key,"original-key");assert.equal(login,true);return {state:"COMMITTED",receipt};}});
 assert(second.restored());await assert.rejects(second.create(cmd),/receipt first/);
 assert.equal(await second.readback(),true);assert(!second.pending());assert.equal(journal.load(),null);
 assert.equal(createStaffRecoveryJournal(storage,id(8)).load(),null);
});
test("NOT_OBSERVED permits only explicit same nonsecret intent with original key",async()=>{
 const {storage}=memory(),journal=createStaffRecoveryJournal(storage,id(9));await journal.prepare(cmd,"original-key");
 const state=createNativeStaffOperationState();restoreNativeStaffOperation(state,journal);let writes=0;
 const control=createNativeStaffCommand({...base,state,journal,read:async()=>({state:"NOT_OBSERVED"}),submit:async(_c,key)=>{writes++;assert.equal(key,"original-key");return receipt;}});
 assert.equal(await control.readback(),false);await assert.rejects(control.create({...cmd,name:"Other"}),/intent differs/);
 assert.equal(writes,0);await control.create(cmd);assert.equal(writes,1);assert.equal(journal.load(),null);
});
test("storage corruption or write failure blocks dispatch",async()=>{
 const {data,storage}=memory(),journal=createStaffRecoveryJournal(storage,id(9));await journal.prepare(cmd,"original-key");
 const slot=Array.from(data.keys())[0]!;data.set(slot,"{}");
 assert.throws(()=>restoreNativeStaffOperation(createNativeStaffOperationState(),journal));
 let writes=0;
 const bad=createStaffRecoveryJournal({...storage,getItem:()=>null,setItem:()=>{throw Error("quota");}},id(9));
 const control=createNativeStaffCommand({...base,journal:bad,submit:async()=>{writes++;return receipt;}});
 await assert.rejects(control.create(cmd),/quota/);assert.equal(writes,0);
});
