import test from "node:test";
import assert from "node:assert/strict";
import { readShiftTemplates, shiftTemplateSchema, shiftTemplateDefinition, createShiftTemplateProvider } from "../app/ho/workforce/shift-templates/schema";

const center="018e6b98-fcc3-7ef2-a1e1-63fbadc82130";
const other="018e6b98-fcc3-7ef2-a1e1-63fbadc82131";
const row={id:"018e6b98-fcc3-7ef2-a1e1-63fbadc82132",centerId:center,code:"PM",displayLabel:"Ca chiều",
 startLocalTime:"13:30",endLocalTime:"17:00",status:"INACTIVE",
 createdAt:"2026-10-31T02:00:00.000Z",updatedAt:"2026-10-31T03:00:00.000Z"};
test("PAP-1198 TDD uses canonical Table/Drawer/Detail and registered HO edit/status slots",()=>{
 assert.equal(shiftTemplateSchema.surface,"HO");
 assert.equal(shiftTemplateSchema.key,"shiftTemplates");
 assert.equal(shiftTemplateDefinition.classification,"TDD_DEFAULT");
 assert.deepEqual(shiftTemplateDefinition.actions?.map(a=>[a.id,a.slot,a.variant,a.capability,a.handler]),
   [["create-shift-template","table.header","primary","create","openCreate"]]);
 assert.deepEqual(shiftTemplateSchema.detail.businessTabs.map(t=>t.id),["edit","status"]);
 assert.equal(shiftTemplateSchema.detail.history.kind,"unavailable");
});
test("PAP-1198 Center-selected TDD provider shows true Core inactive templates and fails closed",async()=>{
 let called=0;
 const fetcher:typeof fetch=async(input)=>{
  called++;
  assert.match(String(input),new RegExp("centerId="+center+"$"));
  return Response.json({data:[row]});
 };
 const signal=new AbortController().signal;
 assert.deepEqual(await readShiftTemplates(center,fetcher,signal),[row]);
 const provider=createShiftTemplateProvider(center);
 const data=await provider.list({} as never,{surface:"HO"},fetcher,signal);
 assert.equal(data.total,1);assert.equal(data.records[0]?.row.status,"INACTIVE");
 assert.deepEqual((await provider.detail(row.id,{surface:"HO"},fetcher,signal))?.row,row);
 assert.equal(called,3);
 await assert.rejects(readShiftTemplates("not-a-center",fetcher,signal),/Center hợp lệ/);
 await assert.rejects(readShiftTemplates(center,async()=>Response.json({data:[{...row,centerId:other}]}),signal),/không hợp lệ/);
 assert.equal(called,3);
});
