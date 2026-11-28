import test from "node:test";import assert from "node:assert/strict";
import type {BusinessFormRequest} from "@/app/components/workspace-renderer/Slots";
import {createLocalStaffRateAction,LOCAL_STAFF_RATE_PRINCIPAL,verifyLocalRateReadback} from "./staff-rate-local-action";
const id="STAFF-MOCK-001";
const r:BusinessFormRequest={surface:"HO",moduleKey:"staffs",slotId:"staff-rate",sourceAdapter:"salary.staff-rate",recordId:id,subject:{type:"staffs",id},principalId:LOCAL_STAFF_RATE_PRINCIPAL,context:{surface:"HO",authorize:p=>["team.bo.access","staff.compensation.manage"].includes(p)}};
const values={amount:125000,effectiveDate:"2026-12-01",reason:"Synthetic sample"};
test("PAP-2347 explicit sample action reads back only its isolated ledger",async()=>{
 const a=createLocalStaffRateAction(x=>x===id),signal=new AbortController().signal;
 assert.equal((await a.applySample(r,values,signal)).status,"saved");
 const read=await a.read(r,signal);assert.equal(read.status,"authorized");if(read.status==="authorized")assert.equal(read.records?.rows.length,1);
 assert.equal((await a.applySample(r,values,signal)).status,"invalid");
 const fresh=await createLocalStaffRateAction(x=>x===id).read(r,signal);assert.equal(fresh.status,"authorized");if(fresh.status==="authorized")assert.equal(fresh.records?.rows.length,0);
});
test("PAP-2347 denies wrong principal, foreign or real record, wrong slot and read-only action",async()=>{
 const a=createLocalStaffRateAction(x=>x===id),signal=new AbortController().signal;
 for(const q of [{...r,principalId:"real-user"},{...r,subject:{type:"staffs",id:"OTHER"}},{...r,recordId:"real-id",subject:{type:"staffs",id:"real-id"}},{...r,slotId:"other"},{...r,context:{surface:"HO" as const,authorize:()=>false}}]){
  assert.equal((await a.read(q,signal)).status,"denied");assert.equal((await a.applySample(q,values,signal)).status,"denied");
 }
 assert.equal((await a.applySample({...r,context:{surface:"HO",authorize:p=>p==="team.bo.access"}},values,signal)).status,"denied");
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(a.applySample(r,values,cancelled.signal));
 const read=await a.read(r,signal);if(read.status==="authorized")assert.equal(read.records?.rows.length,0);
});
test("PAP-2347 exact readback verifies values, previous entries and effective periods",async()=>{
 const a=createLocalStaffRateAction(x=>x===id),signal=new AbortController().signal;
 const before=await a.read(r,signal);
 assert.equal((await a.applySample(r,values,signal)).status,"saved");
 const first=await a.read(r,signal);assert(verifyLocalRateReadback(before,first,values));
 const secondValues={amount:150000,effectiveDate:"2027-01-01",reason:"Second sample"};
 assert.equal((await a.applySample(r,secondValues,signal)).status,"saved");
 const after=await a.read(r,signal);assert(verifyLocalRateReadback(first,after,secondValues));
 assert.equal(verifyLocalRateReadback(first,after,{...secondValues,amount:1}),false);
 assert.equal(verifyLocalRateReadback(first,after,{...secondValues,reason:"wrong"}),false);
 assert.equal(verifyLocalRateReadback(first,after,{...secondValues,effectiveDate:"2027-02-01"}),false);
 if(after.status!=="authorized"||!after.records)assert.fail("missing ledger");
 const wrong={...after,records:{...after.records,rows:after.records.rows.map((row,i)=>i===1?{...row,values:{...row.values,effectiveUntil:"-"}}:row)}};
 assert.equal(verifyLocalRateReadback(first,wrong,secondValues),false);
});
