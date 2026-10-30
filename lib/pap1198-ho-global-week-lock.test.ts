import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { decideHostBoundary } from "./host-boundary";
import { handleHoGlobalWeekLock, parseGlobalWeekLock, type HoGlobalWeekEnv } from "./ho-global-week-lock-facade";
import type { WorkforcePlanningRequest } from "./bo-workforce-planning-handler";

const week = "44e21e2a-b2dd-4e89-b1d7-c8d12d4b9b33";
const path = "/api/ho/workforce/global-week-registration";
const url = "https://ho.staging.pinohouse.art" + path;
const mutation = { termWeekId: week, locked: true, expectedVersion: 0, reason: "Founder đóng đăng ký tất cả chi nhánh" };
const calls: string[] = [];
const env = (environment = "staging"):HoGlobalWeekEnv => ({
  APP_ENV: environment,
  PINO_WORKFORCE_CORE: { executePlanningWithStaffPassword: async (request: WorkforcePlanningRequest) => {
    calls.push(request.path);
    return { status:200,body:{data:{termWeekId:week,locked:true,version:1}},requestId:"stub" };
  } },
}) as unknown as HoGlobalWeekEnv;
const headers = (more: Record<string,string> = {}) => ({
  host:"ho.staging.pinohouse.art", "content-type":"application/json",
  origin:"https://ho.staging.pinohouse.art",...more,
});
test("PAP-1198 global lock payload is exact, has reason, valid TermWeek and CAS", () => {
  assert.deepEqual(parseGlobalWeekLock(mutation),mutation);
  for (const b of [
    {...mutation, termWeekId:"c1"}, {...mutation, locked:1},
    {...mutation, expectedVersion:-1}, {...mutation, expectedVersion:1.1},
    {...mutation, reason:" "}, {...mutation, reason:"x".repeat(501)},
    {...mutation, centerId:"extra"}, {termWeekId:week},
    null,[],1,
  ]) assert.equal(parseGlobalWeekLock(b),null);
});
test("PAP-1198 HO route admits only exact staging host and GET/POST", () => {
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,"GET"),{action:"next"});
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,"POST"),{action:"next"});
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,"PATCH"),{action:"not_found"});
  for(const host of ["bo.staging.pinohouse.art","ho.pinohouse.art","tos.staging.pinohouse.art"])
    assert.deepEqual(decideHostBoundary(host,path,"POST"),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path+"/child","POST"),{action:"not_found"});
});
test("PAP-1198 denies invalid host, prod, methods, origin and absent replay before any Core action",async()=>{
  calls.length=0;
  const prod = await handleHoGlobalWeekLock(new Request(url,{method:"GET",headers:headers()}),env("production"));
  assert.equal(prod.status,404);
  const wrongHost=await handleHoGlobalWeekLock(new Request(url,{method:"GET",headers:headers({host:"bo.staging.pinohouse.art"})}),env());
  assert.equal(wrongHost.status,404);
  const verb=await handleHoGlobalWeekLock(new Request(url,{method:"PATCH",headers:headers()}),env());
  assert.equal(verb.status,405);
  const origin=await handleHoGlobalWeekLock(new Request(url,{method:"POST",headers:headers({origin:"https://evil.test"}),body:JSON.stringify(mutation)}),env());
  assert.equal(origin.status,403);
  const replay=await handleHoGlobalWeekLock(new Request(url,{method:"POST",headers:headers(),body:JSON.stringify(mutation)}),env());
  assert.equal(replay.status,400);
  assert.deepEqual(calls,[]);
});
test("PAP-1198 requires actual Founder pilot + GLOBAL ACL, does not rely on BO cookie alone",async()=>{
  calls.length=0;
  const denied=await handleHoGlobalWeekLock(new Request(url+"?termWeekId="+week,{method:"GET",headers:headers({cookie:"pino_staff_password_session=opaque"})}),env());
  assert.ok([401,403,503].includes(denied.status)); // no configured live BO auth in isolated test; always deny before Core
  assert.deepEqual(calls,[]);
  const source=await readFile("lib/ho-global-week-lock-facade.ts","utf8");
  assert.match(source,/authorizeHoShell/);
  assert.match(source,/operating_cycle\.global_week\.lock/);
  assert.match(source,/readback\.status !== 200/);
  assert.match(source,/state\.locked !== command\.locked/);
  assert.match(source,/expectedVersion \+ 1/);
  assert.match(source,/executePlanningWithStaffPassword/);
});
