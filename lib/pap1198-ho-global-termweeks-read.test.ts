import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";
import { handleHoGlobalTermWeeksRead, parseGlobalTermWeeksResponse, type HoGlobalTermWeeksEnv } from "./ho-global-termweeks-read-facade";
const t="c67e3b01-a7a6-4aa6-afcb-f9d0b676de01";
const w="cb4534cf-cc3d-44a9-9d23-b2fc07e5984e";
const url="https://ho.staging.pinohouse.art/api/ho/workforce/global-termweeks";
const fixture={data:{terms:[{id:t,scopeType:"GLOBAL",displayName:"Term 1"}],
  termWeeks:[{id:w,termId:t,code:"W01",ordinal:1,startDate:"2026-11-01",endDate:"2026-11-07",rhythmKey:"BUILD",updatedAt:"2026-10-29T00:00:00.000Z"}]}};
test("Global TermWeeks parser preserves canonical row and sorted week",()=>{
  assert.deepEqual(parseGlobalTermWeeksResponse(fixture),[{
    id:w,termId:t,name:"Term 1 · W01",code:"W01",ordinal:1,
    startDate:"2026-11-01",endDate:"2026-11-07",rhythmKey:"BUILD",
    updatedAt:"2026-10-29T00:00:00.000Z",
  }]);
  for(const body of [null,{data:{}},{data:{terms:[],termWeeks:fixture.data.termWeeks}},
    {data:{terms:[{...fixture.data.terms[0],scopeType:"CENTER"}],termWeeks:[]}},
    {data:{terms:fixture.data.terms,termWeeks:[{...fixture.data.termWeeks[0],startDate:"tomorrow"}]}}])
    assert.equal(parseGlobalTermWeeksResponse(body),null);
});
test("HO global TermWeeks exact route GET only; never BO/Production",()=>{
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art","/api/ho/workforce/global-termweeks","GET"),{action:"next"});
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art","/api/ho/workforce/global-termweeks","POST"),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art","/api/ho/workforce/global-termweeks","GET"),{action:"not_found"});
});
test("invalid host/method/environment fail before any Core call",async()=>{
  let called=0;
  const env={APP_ENV:"staging",PINO_WORKFORCE_CORE:{executePlanningWithStaffPassword:async()=>{called++;throw Error("should not call");}}} as unknown as HoGlobalTermWeeksEnv;
  const request=(host:string,method="GET")=>new Request(url,{method,headers:{host}});
  assert.equal((await handleHoGlobalTermWeeksRead(request("bo.staging.pinohouse.art"),env)).status,404);
  assert.equal((await handleHoGlobalTermWeeksRead(request("ho.staging.pinohouse.art","POST"),env)).status,405);
  assert.equal((await handleHoGlobalTermWeeksRead(request("ho.staging.pinohouse.art"),{...env,APP_ENV:"production"})).status,404);
  assert.equal(called,0);
});
test("unauthenticated HO request cannot query Global weeks Core service",async()=>{
  let called=0;
  const env={APP_ENV:"staging",PINO_WORKFORCE_CORE:{executePlanningWithStaffPassword:async()=>{called++;throw Error("should not call");}}} as unknown as HoGlobalTermWeeksEnv;
  const response=await handleHoGlobalTermWeeksRead(new Request(url,{headers:{host:"ho.staging.pinohouse.art"}}),env);
  assert.ok([401,403,503].includes(response.status));
  assert.equal(called,0);
});
