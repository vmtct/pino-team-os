import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";
import { handleHoGlobalTermWeekUpdate,parseHoGlobalWeekUpdate } from "./ho-global-termweeks-update-facade";
import type { HoGlobalTermWeeksEnv } from "./ho-global-termweeks-read-facade";

const weekId="c67e3b01-a7a6-4aa6-afcb-f9d0b676de02";
const path="/api/ho/workforce/global-termweeks/"+weekId+"/update";
const route="https://ho.staging.pinohouse.art"+path;
const valid={code:"W02",ordinal:2,startDate:"2026-11-08",endDate:"2026-11-14",
 rhythmKey:"BUILD",expectedUpdatedAt:"2026-10-30T00:00:00.000Z"};
function headers(extra:Record<string,string>={}){
 return {host:"ho.staging.pinohouse.art",origin:"https://ho.staging.pinohouse.art",
  "content-type":"application/json","idempotency-key":"pap1198_update_001",...extra};
}
test("PAP-1198 HO update parser requires strict CAS, calendar dates and exact fields",()=>{
 assert.deepEqual(parseHoGlobalWeekUpdate(valid),valid);
 for(const v of [null,[],{...valid,ordinal:0},{...valid,startDate:"2026-02-30"},
  {...valid,endDate:"2026-10-29"},{...valid,rhythmKey:"bad value"},
  {...valid,expectedUpdatedAt:"not-time"},{...valid,centerId:weekId}])
  assert.equal(parseHoGlobalWeekUpdate(v),null);
});
test("PAP-1198 update exact HO staging host/method only, no BO/TOS/Production aperture",()=>{
 assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,"POST"),{action:"next"});
 for(const host of ["ho.pinohouse.art","bo.staging.pinohouse.art","tos.staging.pinohouse.art"]){
  assert.deepEqual(decideHostBoundary(host,path,"POST"),{action:"not_found"});
 }
 for(const verb of ["GET","PATCH","DELETE"]){
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,verb),{action:"not_found"});
 }
});
test("PAP-1198 update rejects wrong host, production, origin and replay before Core",async()=>{
 let invoked=0;
 const env={APP_ENV:"staging",PINO_WORKFORCE_CORE:{
  executePlanningWithStaffPassword:async()=>{invoked++;throw Error("must not invoke Core");},
 }} as unknown as HoGlobalTermWeeksEnv;
 const send=(h:Record<string,string>,e=env,method="POST")=>
  handleHoGlobalTermWeekUpdate(new Request(route,{method,headers:h,
   body:method==="POST"?JSON.stringify(valid):undefined}),e);
 assert.equal((await send(headers({host:"bo.staging.pinohouse.art"}))).status,404);
 assert.equal((await send(headers(),{...env,APP_ENV:"production"})).status,404);
 assert.equal((await send(headers(),env,"PATCH")).status,405);
 assert.equal((await send(headers({origin:"https://evil.example"}))).status,403);
 assert.equal((await send(headers({"idempotency-key":""}))).status,400);
 assert.equal(invoked,0);
});
test("PAP-1198 update refuses anonymous writes without Core call",async()=>{
 let invoked=0;
 const env={APP_ENV:"staging",PINO_WORKFORCE_CORE:{
  executePlanningWithStaffPassword:async()=>{invoked++;throw Error("must not invoke Core");},
 }} as unknown as HoGlobalTermWeeksEnv;
 const r=await handleHoGlobalTermWeekUpdate(new Request(route,{
  method:"POST",headers:headers(),body:JSON.stringify(valid),
 }),env);
 assert.ok([401,403,503].includes(r.status));
 assert.equal(invoked,0);
});
