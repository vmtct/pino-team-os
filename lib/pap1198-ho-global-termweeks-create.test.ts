import test from "node:test";
import assert from "node:assert/strict";
import { handleHoGlobalTermWeeksCreate, parseHoGlobalWeekCreate } from "./ho-global-termweeks-create-facade";
import type { HoGlobalTermWeeksEnv } from "./ho-global-termweeks-read-facade";

const termId = "c67e3b01-a7a6-4aa6-afcb-f9d0b676de01";
const route = "https://ho.staging.pinohouse.art/api/ho/workforce/global-termweeks";
const valid = {
  termId, code: "W02", ordinal: 2,
  startDate: "2026-11-08", endDate: "2026-11-14", rhythmKey: "BUILD",
};
const headers = (more: Record<string,string> = {}) => ({
  host: "ho.staging.pinohouse.art",
  origin: "https://ho.staging.pinohouse.art",
  "content-type": "application/json",
  "idempotency-key": "pap1198_create_week_test_001",
  ...more,
});
test("PAP-1198 Create parses exact valid Global TermWeek, refuses invalid dates and extra fields", () => {
  assert.deepEqual(parseHoGlobalWeekCreate(valid), valid);
  for (const payload of [
    null, [], { ...valid, termId:"not-uuid" }, { ...valid, code:" " },
    { ...valid, ordinal:0 }, { ...valid, ordinal:1.5 },
    { ...valid, startDate:"2026-02-30" },
    { ...valid, endDate:"2026-11-07" },
    { ...valid, rhythmKey:"bad key" }, { ...valid, centerId:"illegal" },
  ]) assert.equal(parseHoGlobalWeekCreate(payload), null);
});
test("PAP-1198 Create refuses host/method/environment/origin/replay before Core call", async () => {
  let called = 0;
  const env = {
    APP_ENV:"staging",
    PINO_WORKFORCE_CORE:{
      executePlanningWithStaffPassword:async()=>{called++; throw Error("Core must not be called");},
    },
  } as unknown as HoGlobalTermWeeksEnv;
  const send = (method:string, h:Record<string,string>, e=env) =>
    handleHoGlobalTermWeeksCreate(new Request(route,{
      method,headers:h,body:method==="POST"?JSON.stringify(valid):undefined,
    }), e);
  assert.equal((await send("POST",headers({host:"bo.staging.pinohouse.art"}))).status,404);
  assert.equal((await send("POST",headers(),{...env, APP_ENV:"production"})).status,404);
  assert.equal((await send("PATCH",headers())).status,405);
  assert.equal((await send("POST",headers({origin:"https://evil.test"}))).status,403);
  assert.equal((await send("POST",headers({"idempotency-key":""}))).status,400);
  assert.equal(called,0);
});
test("PAP-1198 Create requires live Founder/HO global permission; anonymous cannot write",async()=>{
  let called=0;
  const env={APP_ENV:"staging",PINO_WORKFORCE_CORE:{
    executePlanningWithStaffPassword:async()=>{called++;throw Error("no Core access");}
  }} as unknown as HoGlobalTermWeeksEnv;
  const response=await handleHoGlobalTermWeeksCreate(new Request(route,{
    method:"POST",headers:headers(),body:JSON.stringify(valid),
  }),env);
  assert.ok([401,403,503].includes(response.status));
  assert.equal(called,0);
});
