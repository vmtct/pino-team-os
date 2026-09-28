import test from "node:test";
import assert from "node:assert/strict";
import { handleBoWorkforcePlanningRequest, type BoWorkforcePlanningEnv, type WorkforcePlanningCoreBinding, type WorkforcePlanningRequest } from "./bo-workforce-planning-handler";

const token="local-session-token";
const env=(binding:WorkforcePlanningCoreBinding):BoWorkforcePlanningEnv=>({PINO_WORKFORCE_CORE:binding});
const headers=(key?:string)=>({cookie:`pino_staff_password_session=${token}`,"content-type":"application/json",...(key?{"idempotency-key":key}:{})});
const binding=(forwarded:WorkforcePlanningRequest[]):WorkforcePlanningCoreBinding=>({executePlanningWithStaffPassword:async(request)=>{forwarded.push(request);return{status:200,body:{data:{state:"OPEN"}},requestId:"wwc"};}});

test("WWC Team facade forwards bounded week-control read and mutations",async()=>{
  const forwarded:WorkforcePlanningRequest[]=[],b=binding(forwarded);
  const read=new Request("https://bo.pinohouse.art/api/bo/workforce/planning/week-control?centerId=c1&termWeekId=w1&userId=forged",{headers:headers()});
  assert.equal((await handleBoWorkforcePlanningRequest(read,env(b),"workforce/planning/week-control")).status,200);
  const commands=[
    ["workforce/planning/availability/lock",{centerId:"c1",termWeekId:"w1",expectedVersion:0,reason:"Lock"}],
    ["workforce/planning/availability/reopen",{centerId:"c1",termWeekId:"w1",expectedVersion:1,reason:"Late",until:"2026-10-02T03:00:00.000Z"}],
    ["workforce/planning/planning/publish",{centerId:"c1",termWeekId:"w1",expectedVersion:2,reason:"Final"}],
    ["workforce/planning/planning/reopen",{centerId:"c1",termWeekId:"w1",expectedVersion:3,reason:"Correction",until:"2026-10-02T04:00:00.000Z"}],
  ] as const;
  for(const [path,body] of commands){
    const req=new Request(`https://bo.pinohouse.art/api/bo/${path}`,{method:"POST",headers:headers(path),body:JSON.stringify(body)});
    assert.equal((await handleBoWorkforcePlanningRequest(req,env(b),path)).status,200);
  }
  assert.deepEqual(forwarded,[
    {method:"GET",path:"week-control",body:{centerId:"c1",termWeekId:"w1"}},
    ...commands.map(([path,body])=>({method:"POST",path:path.slice("workforce/planning/".length),body,idempotencyKey:path})),
  ]);
});

test("WWC Team facade requires replay evidence for lock/reopen mutations",async()=>{
  let called=false;
  const b:WorkforcePlanningCoreBinding={executePlanningWithStaffPassword:async()=>{called=true;throw new Error("unexpected");}};
  const path="workforce/planning/availability/lock";
  const req=new Request(`https://bo.pinohouse.art/api/bo/${path}`,{method:"POST",headers:headers(),body:JSON.stringify({centerId:"c",termWeekId:"w",expectedVersion:0,reason:"x"})});
  assert.equal((await handleBoWorkforcePlanningRequest(req,env(b),path)).status,400);
  assert.equal(called,false);
});

import { readFile } from "node:fs/promises";

test("WWC Schedule & Time renders independent effective windows and ACL-gated controls",async()=>{
  const source=await readFile("app/bo/workforce/WorkforcePlanningView.tsx","utf8");
  assert.match(source,/Kiểm soát tuần/);
  assert.match(source,/Khóa đăng ký/);
  assert.match(source,/Mở lại đăng ký/);
  assert.match(source,/Chốt xếp ca/);
  assert.match(source,/Mở khóa xếp ca/);
  assert.match(source,/canLockAvailability/);
  assert.match(source,/canReopenPlanning/);
  assert.match(source,/data\.windows\?\.planning\.state === "LOCKED"/);
});

test("WWC TOS keeps SUBMITTED amendable while OPEN and distinguishes lock/config states",async()=>{
  const source=await readFile("app/components/WorkforceWorkspace.tsx","utf8");
  assert.match(source,/Bạn vẫn có thể chỉnh và gửi lại/);
  assert.match(source,/Gửi lại cho Manager/);
  assert.match(source,/CONFIGURATION_UNAVAILABLE/);
  assert.match(source,/availabilityWindow\?\.state !== "OPEN"/);
  assert.match(source,/Đăng ký ca đã khóa/);
});
