import assert from "node:assert/strict";
import test from "node:test";
import {adjustmentRequest,submitPayrollAdjustment,canSubmitPayrollAdjustmentScope} from "./bo-payroll-adjustment-client";
import type {AdjustmentCommand} from "./bo-payroll-adjustment-confirmation";
const centerId="0199f001-0000-7000-8000-000000000002",periodId="0199f001-0000-7000-8000-000000000003",staffId="0199f001-0000-7000-8000-000000000004";
const expectedFingerprint="a".repeat(64);
const command:AdjustmentCommand={centerId,periodId,staffId,amountMinor:-1000,reason:"Synthetic deduction",expectedFingerprint,idempotencyKey:"pay-adjust-"+expectedFingerprint+":synthetic-123"};
test("PAP-1956 builds exact same-origin signed CAS command without alternate route",async()=>{
 const {path,init}=adjustmentRequest(command);
 assert.equal(path,"/api/bo/workforce/payroll/periods/"+periodId+"/staff/"+staffId+"/financial-adjustments?centerId="+centerId);
 assert.equal(init.method,"POST");assert.equal(init.credentials,"same-origin");assert.equal(init.cache,"no-store");assert.equal(init.redirect,"error");
 assert.deepEqual(init.headers,{"content-type":"application/json","idempotency-key":command.idempotencyKey});
 assert.deepEqual(JSON.parse(String(init.body)),{centerId,amountMinor:-1000,reason:command.reason,expectedFingerprint});
 let calls=0;
 const transport:typeof fetch=async (input,options)=>{calls++;assert.equal(input,path);assert.deepEqual(options,init);return Response.json({data:{id:"fixture"}},{status:201});};
 assert.deepEqual(await submitPayrollAdjustment(command,transport),{id:"fixture"});assert.equal(calls,1);
});
test("PAP-1956 malformed or fixed synthetic commands never reach transport",async()=>{
 let calls=0;const transport:typeof fetch=async()=>{calls++;throw Error("unexpected")};
 for(const bad of [{...command,periodId:"../other"},{...command,centerId:"wrong"},{...command,staffId:"wrong"},{...command,amountMinor:0},{...command,amountMinor:0.5},{...command,amountMinor:1e13},{...command,reason:" x "},{...command,expectedFingerprint:"bad"},{...command,idempotencyKey:"other"},{...command,periodId:"01a171ed-eb78-7941-b1de-dd4c020457b7",staffId:"01a18a28-6d8e-7db7-acbb-a18a942a5e72"}])await assert.rejects(submitPayrollAdjustment(bad,transport),/INVALID/);
 assert.equal(calls,0);
});
test("PAP-1956 client rejects ambiguous or rejected receipts without retry",async()=>{
 for(const r of [Response.json({data:{id:"fixture"}},{status:200}),Response.json({error:{}},{status:409}),Response.json({data:null},{status:201}),Response.json({data:[]},{status:201}),Response.json({},{status:201})]){
  let calls=0;const transport:typeof fetch=async()=>{calls++;return r};
  await assert.rejects(submitPayrollAdjustment(command,transport),/UNCONFIRMED/);assert.equal(calls,1);
 }
 let calls=0;await assert.rejects(submitPayrollAdjustment(command,async()=>{calls++;throw Error("network uncertain")}));assert.equal(calls,1);
});
test("PAP-1956 product CTA excludes the historical fixed fixture and invalid selection",()=>{
 assert.equal(canSubmitPayrollAdjustmentScope(centerId,periodId,staffId),true);
 assert.equal(canSubmitPayrollAdjustmentScope(centerId,"bad",staffId),false);
 assert.equal(canSubmitPayrollAdjustmentScope(centerId,"01a171ed-eb78-7941-b1de-dd4c020457b7","01a18a28-6d8e-7db7-acbb-a18a942a5e72"),false);
});