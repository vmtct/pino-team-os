import assert from "node:assert/strict";
import test from "node:test";
import {BoApiError} from "./bo-api-error";
import {finishGuestWithParent,GuestParentCommitted,guestKnownFailure} from "../app/bo/mytime-guests/guardian-recovery";
const parent={id:"019d2202-0000-7000-8000-000000000001",label:"QA Parent · 00000001",name:"QA Parent",phone:"+8••••01"};
test("PAP-2202 known Guest failure returns only the committed Parent reference",async()=>{
 const e=new BoApiError(400,"invalid",null,true);
 await assert.rejects(finishGuestWithParent(parent,async()=>{throw e;}),v=>v instanceof GuestParentCommitted&&v.parent===parent&&v.causeError===e);
 await assert.rejects(finishGuestWithParent(null,async()=>{throw e;}),v=>v===e);
});
test("PAP-2202 uncertain commands preserve original retry identity",async()=>{
 for(const e of [new Error("network"),new BoApiError(502,"bad",null,false),new BoApiError(409,"unknown",null,false)]){
  assert.equal(guestKnownFailure(e),false);
  await assert.rejects(finishGuestWithParent(parent,async()=>{throw e;}),v=>v===e);
 }
 assert.equal(await finishGuestWithParent(parent,async()=>42),42);
});
