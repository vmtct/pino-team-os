// PAP-2358 · WFM-STAFF. No live request; strict projection regression.
import test from "node:test";
import assert from "node:assert/strict";
import {nativeManualStaffProvider,projectHoStaffRow} from "./native-staff-provider";
import {manualStaffQuery} from "./manual-create-contract";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const base={id:id(1),displayLabel:"QA Staff",status:"active",roleLabel:null,createdAt:"2026-11-25T00:00:00Z",updatedAt:"2026-11-25T00:00:00Z",createdByUserId:id(2),updatedByUserId:null};
const detail={...base,mobile:"+84912345678",email:"qa@example.invalid",gender:"Nữ",birthDate:"2000-02-29",loginEmail:null,centers:[{id:id(3),label:"QA Center"}]};
const signal=new AbortController().signal;
test("list is broad and unknown role/audit stays unknown",async()=>{
 const result=await nativeManualStaffProvider.list(manualStaffQuery,{surface:"HO"},async(url,init)=>{
  assert.equal(url,"/api/ho/staff/directory");assert.equal(init?.cache,"no-store");return Response.json({data:[base]});
 },signal);
 assert.equal(result.total,1);const row=result.records[0]!.row;
 assert.equal(row.name,base.displayLabel);assert.equal(row.role,null);assert.equal(row.email,null);assert.equal(row.updatedBy,null);assert.equal(row.createdBy,null);
});
test("detail is exact canonical record and authoritative affiliation only",async()=>{
 const result=await nativeManualStaffProvider.detail(id(1),{surface:"HO"},async(url)=>{
  assert.equal(url,"/api/ho/staff/directory/"+id(1));return Response.json({data:detail});
 },signal);
 assert.equal(result?.row.phone,detail.mobile);assert.equal(result?.row.center,"QA Center");assert.equal(result?.row.loginEmail,null);
 await assert.rejects(nativeManualStaffProvider.detail(id(9),{surface:"HO"},async()=>Response.json({data:detail}),signal));
 assert.equal(await nativeManualStaffProvider.detail(id(1),{surface:"HO"},async()=>Response.json({data:null}),signal),null);
});
test("reject extras, duplicates, bad DTO and foreign scope; no fallback",async()=>{
 for(const bad of [{...base,email:"qa@example.invalid"},{...base,id:"STAFF-MOCK-001"},{...base,createdAt:"fake"}])assert.throws(()=>projectHoStaffRow(bad));
 assert.throws(()=>projectHoStaffRow({...detail,centers:[...detail.centers,...detail.centers]},true));
 await assert.rejects(nativeManualStaffProvider.list(manualStaffQuery,{surface:"HO"},async()=>Response.json({data:[base,base]}),signal));
 await assert.rejects(nativeManualStaffProvider.list(manualStaffQuery,{surface:"BO",centerId:id(3)},async()=>{throw Error("unexpected");},signal),/HO only/);
 await assert.rejects(nativeManualStaffProvider.list(manualStaffQuery,{surface:"HO"},async()=>new Response(null,{status:403}),signal));
});
