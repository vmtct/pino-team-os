import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest, type BoReadEnv } from "./bo-read-handler";
import { handleBoWriteRequest, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const token="local-password-session";
const env=(binding:BoAccessCoreBinding):BoReadEnv&BoWriteEnv=>({PINO_BO_CORE:binding});
const cookie={cookie:`pino_staff_password_session=${token}`};

test("WWC Policies facade forwards exact GLOBAL/CENTER targets and effectiveAt",async()=>{
  const forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={executeWithStaffPassword:async(request)=>{forwarded.push(request);return{status:200,body:{data:null},requestId:"policy-read"};}};
  const globalPath="policies/workforce/AVAILABILITY_WINDOW_V1/stream";
  const globalReq=new Request(`https://bo.pinohouse.art/api/bo/${globalPath}?targetType=GLOBAL&targetId=forged`,{headers:cookie});
  assert.equal((await handleBoOperationalReadRequest(globalReq,env(binding),globalPath)).status,200);
  const centerPath="policies/workforce/PLANNING_WINDOW_V1/effective";
  const centerReq=new Request(`https://bo.pinohouse.art/api/bo/${centerPath}?targetType=CENTER&targetId=center-1&effectiveAt=2026-09-27T12%3A00%3A00.000Z&userId=forged`,{headers:cookie});
  assert.equal((await handleBoOperationalReadRequest(centerReq,env(binding),centerPath)).status,200);
  assert.deepEqual(forwarded,[
    {method:"GET",path:globalPath,body:{targetType:"GLOBAL",targetId:null}},
    {method:"GET",path:centerPath,body:{targetType:"CENTER",targetId:"center-1",effectiveAt:"2026-09-27T12:00:00.000Z"}},
  ]);
});

test("WWC Policies writes are allowlisted and replay-protected",async()=>{
  const forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={executeWithStaffPassword:async(request)=>{forwarded.push(request);return{status:201,body:{data:{versionId:"v"}},requestId:"policy-write"};}};
  const path="policies/workforce/AVAILABILITY_WINDOW_V1/versions";
  const body={targetType:"CENTER",targetId:"center-1",value:{autoLock:{enabled:true,timeLocal:"20:00",daysBeforeWeekStart:2}},changeReason:"Center cadence",expectedRevision:0};
  const noKey=new Request(`https://bo.pinohouse.art/api/bo/${path}`,{method:"POST",headers:{...cookie,"content-type":"application/json"},body:JSON.stringify(body)});
  assert.equal((await handleBoWriteRequest(noKey,env(binding),path)).status,400);
  const req=new Request(`https://bo.pinohouse.art/api/bo/${path}`,{method:"POST",headers:{...cookie,"content-type":"application/json","idempotency-key":"policy-key"},body:JSON.stringify(body)});
  assert.equal((await handleBoWriteRequest(req,env(binding),path)).status,201);
  assert.deepEqual(forwarded,[{method:"POST",path,body,idempotencyKey:"policy-key"}]);
});

import { readFile } from "node:fs/promises";

test("WWC Policies page exposes GLOBAL default, CENTER override and exact business controls",async()=>{
  const [eligibilityView,windowView,nav]=await Promise.all([
    readFile("app/bo/system/policies/WorkforcePoliciesView.tsx","utf8"),
    readFile("app/bo/system/policies/WeekControlPoliciesView.tsx","utf8"),
    readFile("app/bo/navigation.ts","utf8"),
  ]);
  const view=eligibilityView+"\n"+windowView;
  assert.match(nav,/href: "\/bo\/system\/policies", label: "Policies"/);
  assert.match(view,/GLOBAL default/);
  assert.match(view,/CENTER override/);
  assert.match(view,/AVAILABILITY_WINDOW_V1/);
  assert.match(view,/PLANNING_WINDOW_V1/);
  assert.match(view,/Tự động khóa/);
  assert.match(view,/Trước tuần mới/);
  assert.match(view,/Lý do thay đổi/);
  assert.match(view,/canManageGlobalPolicy/);
  assert.match(view,/canManageCenterPolicy/);
});
