import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";
import { handleHoShiftTemplateWrite, parseHoShiftTemplateWrite, type HoShiftTemplateWriteAction } from "./ho-shift-templates-mutation-facade";
import type { HoShiftTemplatesEnv } from "./ho-shift-templates-read-facade";
const c="018e6b98-fcc3-7ef2-a1e1-63fbadc82130", id="018e6b98-fcc3-7ef2-a1e1-63fbadc82132";
const host="ho.staging.pinohouse.art", url="https://"+host+"/api/ho/workforce/shift-templates";
const create={centerId:c,code:"EVENING",displayLabel:"Ca tối",startLocalTime:"17:30",endLocalTime:"21:00"};
const update={...create,expectedUpdatedAt:"2026-10-31T03:00:00.000Z"};
const status={centerId:c,status:"INACTIVE",expectedUpdatedAt:"2026-10-31T03:00:00.000Z"};
test("PAP-1198 mutation parser validates exact create/update/status and canonical CAS",()=>{
  assert.deepEqual(parseHoShiftTemplateWrite(create,"create"),create);
  assert.deepEqual(parseHoShiftTemplateWrite(update,"update"),update);
  assert.deepEqual(parseHoShiftTemplateWrite(status,"status"),status);
  const wrong: Array<[unknown, HoShiftTemplateWriteAction]>=[
    [{...create,centerId:"invalid"},"create"],[{...create,unexpected:"yes"},"create"],
    [{...create,startLocalTime:"21:30"},"create"],[{...create,displayLabel:" Ca tối"},"create"],
    [create,"update"],[{...update,expectedUpdatedAt:"2026-10-31"},"update"],
    [{...status,status:"ARCHIVED"},"status"],[{...status,extra:0},"status"],
    [{...status,expectedUpdatedAt:"wrong"},"status"],
  ];
  for(const [value,action] of wrong)assert.equal(parseHoShiftTemplateWrite(value,action),null);
});
test("PAP-1198 HO routes expose only POST mutation and reject BO/TOS/Production",()=>{
  const u="/api/ho/workforce/shift-templates";
  for(const route of [u,u+"/"+id+"/status",u+"/"+id+"/update"]){
    assert.deepEqual(decideHostBoundary(host,route,"POST"),{action:"next"});
    if(route!==u)assert.deepEqual(decideHostBoundary(host,route,"GET"),{action:"not_found"});
    for(const forbidden of ["bo.staging.pinohouse.art","ho.pinohouse.art","tos.staging.pinohouse.art"])
      assert.deepEqual(decideHostBoundary(forbidden,route,"POST"),{action:"not_found"});
  }
});
test("PAP-1198 mutation denies bad host, origin, replay, payload and production without Core call",async()=>{
  let called=0;
  const env={APP_ENV:"staging",PINO_WORKFORCE_CORE:{executePlanningWithStaffPassword:async()=>{called++;throw Error("Core should not be called");}}} as unknown as HoShiftTemplatesEnv;
  const request=(path:string,body:unknown,headers:Record<string,string>={},method="POST")=>
    new Request(url+path,{method,headers:{"host":host,"origin":"https://"+host,"content-type":"application/json","idempotency-key":"pap1198-create-1",...headers},body:method==="POST"?JSON.stringify(body):undefined});
  assert.equal((await handleHoShiftTemplateWrite(request("",create,{"host":"bo.staging.pinohouse.art"}),env)).status,404);
  assert.equal((await handleHoShiftTemplateWrite(request("",create),{...env,APP_ENV:"production"})).status,404);
  assert.equal((await handleHoShiftTemplateWrite(request("",create,{"origin":"https://attacker.example"}),env)).status,403);
  assert.equal((await handleHoShiftTemplateWrite(request("",create,{"idempotency-key":"bad"}),env)).status,400);
  assert.equal((await handleHoShiftTemplateWrite(request("",{...create,centerId:"wrong"}),env)).status,400);
  assert.equal((await handleHoShiftTemplateWrite(request("/"+id+"/update",create),env)).status,400);
  assert.equal((await handleHoShiftTemplateWrite(request("/"+id+"/status",{...status,status:"BAD"}),env)).status,400);
  assert.equal((await handleHoShiftTemplateWrite(request("",create,{},"GET"),env)).status,405);
  const unauth=await handleHoShiftTemplateWrite(request("",create),env);
  assert.ok([401,403,503].includes(unauth.status));
  assert.equal(called,0);
});
