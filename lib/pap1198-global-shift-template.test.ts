import test from "node:test";
import assert from "node:assert/strict";
import {parseHoShiftTemplates} from "./ho-shift-templates-read-facade";
import {parseHoShiftTemplateWrite} from "./ho-shift-templates-mutation-facade";
import {createShiftTemplateProvider,readShiftTemplates} from "../app/ho/workforce/shift-templates/schema";
import {surfaceSession} from "./workspace-adapters/session";
const center="019a4000-0000-7000-8000-000000000001",id="019a4000-0000-7000-8000-000000000002";
const at="2026-11-03T00:00:00.000Z";
const global={id,scopeType:"GLOBAL",centerId:null,code:"GLOBAL",displayLabel:"Ca chung",startLocalTime:"08:00",endLocalTime:"09:00",status:"ACTIVE",createdAt:at,updatedAt:at,assignmentCount:3,availabilityCount:1,
 history:[{id:"019a4000-0000-7000-8000-000000000003",occurredAt:at,actorId:null,action:"WORKFORCE_SHIFT_TEMPLATE_UPDATED",changes:[{field:"code",before:"OLD",after:"GLOBAL"}]}]};
test("GLOBAL/all catalog validates explicit scope, null Center, usage and subject history",()=>{
 assert.deepEqual(parseHoShiftTemplates({data:[global]},"GLOBAL"),[global]);
 const local={...global,id:"019a4000-0000-7000-8000-000000000004",scopeType:"CENTER",centerId:center};
 assert.equal(parseHoShiftTemplates({data:[global,local]},"ALL")?.length,2);
 for(const row of [{...global,centerId:center},{...global,scopeType:"CENTER"},{...global,scopeType:null},{...global,assignmentCount:-1},{...global,history:[{...global.history[0],changes:[{field:"secret",before:null,after:"x"}]}]}])assert.equal(parseHoShiftTemplates({data:[row]},"ALL"),null);
 assert.equal(parseHoShiftTemplates({data:[global]},center),null);
});
test("GLOBAL writes require explicit null Center; scope/foreign fields and forged versions fail closed",()=>{
 const form={scopeType:"GLOBAL",centerId:null,code:"GLOBAL",displayLabel:"Ca chung",startLocalTime:"08:00",endLocalTime:"09:00",status:"INACTIVE"};
 assert.deepEqual(parseHoShiftTemplateWrite(form,"create"),form);
 assert.equal(parseHoShiftTemplateWrite({...form,centerId:center},"create"),null);
 assert.equal(parseHoShiftTemplateWrite({...form,scopeType:"CENTER"},"create"),null);
 assert.equal(parseHoShiftTemplateWrite({...form,scopeType:null},"create"),null);
 assert.equal(parseHoShiftTemplateWrite({...form,unexpected:true},"create"),null);
 assert.equal(parseHoShiftTemplateWrite({scopeType:"GLOBAL",centerId:null,status:"INACTIVE",expectedUpdatedAt:at},"status")?.centerId,null);
});
test("HO TDD transports ALL/GLOBAL reads only and provider binds real history",async()=>{
 const signal=new AbortController().signal;
 const fetcher:typeof fetch=async()=>Response.json({data:[global]});
 const session=surfaceSession("HO","https://ho.staging.pinohouse.art",fetcher);
 for(const value of ["ALL","GLOBAL"]){
  assert.equal((await session.transport("/api/ho/workforce/shift-templates?centerId="+value)).status,200);
  await assert.rejects(session.transport("/api/ho/workforce/shift-templates?centerId="+value,{method:"POST"}),{status:404});
 }
 const rows=await readShiftTemplates("GLOBAL",fetcher,signal);assert.equal(rows[0]?.scopeType,"GLOBAL");assert.equal(rows[0]?.assignmentCount,3);
 const provider=createShiftTemplateProvider("ALL");
 const history=provider.history!.bind(fetcher,{surface:"HO"});assert.equal(history.kind,"provider");
 if(history.kind==="provider"){
  const result=await history.load({type:"shift_template",id},{surface:"HO",authorize:()=>true},null,signal);
  assert.equal(result.status,"authorized");if(result.status==="authorized"){assert.equal(result.events.length,1);assert.equal(result.events[0]?.changes?.[0]?.after,"GLOBAL");}
  assert.equal((await history.load({type:"wrong",id},{surface:"HO",authorize:()=>true},null,signal)).status,"denied");
 }
 session.dispose();
});
