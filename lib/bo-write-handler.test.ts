import test from "node:test";
import assert from "node:assert/strict";
import { handleBoStaffOnboardingRequest, handleBoWriteRequest, isPracticeWritePath, type BoWriteEnv } from "./bo-write-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
const token="local-password-session",path="workforce/staff-onboarding";
const env=(binding:BoAccessCoreBinding):BoWriteEnv=>({PINO_BO_CORE:binding});
function request(route=path,authenticated=true,body:unknown={},idempotencyKey?:string,method="POST"){const headers:Record<string,string>={"content-type":"application/json"};if(authenticated)headers.cookie=`pino_staff_password_session=${token}`;if(idempotencyKey)headers["idempotency-key"]=idempotencyKey;return new Request(`https://bo.pinohouse.art/api/bo/${route}`,{method,headers,...(method==="GET"?{}:{body:JSON.stringify(body)})});}
test("BO writes forward exact request and password token",async()=>{const forwarded:Array<{request:BoAccessRequest;token:string}>=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(coreRequest,value){forwarded.push({request:coreRequest,token:value});return{status:201,body:{data:{ok:true}},requestId:"created"};}};const body={commandType:"ONBOARD_STAFF_WITH_ACCESS",staff:{displayLabel:"Staff A"},email:"staff@example.com",assignments:[]};const response=await handleBoStaffOnboardingRequest(request(path,true,body,"command-1"),env(binding),path);assert.equal(response.status,201);assert.deepEqual(forwarded,[{request:{method:"POST",path,body,idempotencyKey:"command-1"},token}]);});
test("missing local session fails before Core",async()=>{let called=false;const binding:BoAccessCoreBinding={async executeWithStaffPassword(){called=true;throw new Error("unexpected");}};assert.equal((await handleBoStaffOnboardingRequest(request(path,false,{},"k"),env(binding),path)).status,401);assert.equal(called,false);});
test("replay protected paths require idempotency",async()=>{let called=false;const binding:BoAccessCoreBinding={async executeWithStaffPassword(){called=true;throw new Error("unexpected");}};assert.equal((await handleBoStaffOnboardingRequest(request(path,true,{}),env(binding),path)).status,400);assert.equal(called,false);});
test("Staff PIN reset rejects manager-selected PIN",async()=>{let called=false;const binding:BoAccessCoreBinding={async executeWithStaffPassword(){called=true;return{status:200,body:{data:{}},requestId:"x"};}};const reset="access/users/0198d050-56c1-7ac5-b9ab-b0e45d912345/staff-pin/reset";assert.equal((await handleBoStaffOnboardingRequest(request(reset,true,{pin:"123456"},"reset-1"),env(binding),reset)).status,400);assert.equal(called,false);});
test("Core denial and request ID pass through",async()=>{const binding:BoAccessCoreBinding={async executeWithStaffPassword(){return{status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"denied"};}};const response=await handleBoStaffOnboardingRequest(request(path,true,{},"k"),env(binding),path);assert.equal(response.status,403);assert.equal(response.headers.get("x-request-id"),"denied");});
test("Practice allowlist stays bounded",()=>{const id="0198d050-56c1-7ac5-b9ab-b0e45d912345";assert.equal(isPracticeWritePath("practice/repertoire-access/grants"),true);assert.equal(isPracticeWritePath(`practice/repertoire-access/grants/${id}/revoke`),true);assert.equal(isPracticeWritePath("practice/media"),false);});
test("unknown paths and wrong methods fail closed",async()=>{let called=false;const binding:BoAccessCoreBinding={async executeWithStaffPassword(){called=true;throw new Error("unexpected");}};assert.equal((await handleBoStaffOnboardingRequest(request("access/users",true,{},"k"),env(binding),"access/users")).status,404);assert.equal((await handleBoStaffOnboardingRequest(request(path,true,{},undefined,"GET"),env(binding),path)).status,405);assert.equal(called,false);});

test("Term and TermWeek commands require replay evidence and forward exact bounded BO commands",async()=>{
  const centerId="01912345-6789-7abc-8def-0123456789ab",termId="01912345-6789-7abc-8def-0123456789ac",weekId="01912345-6789-7abc-8def-0123456789ad",forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(coreRequest){forwarded.push(coreRequest);return{status:coreRequest.path==="delivery/terms"||coreRequest.path==="delivery/term-weeks"?201:200,body:{data:{id:coreRequest.path==="delivery/terms"?termId:weekId}},requestId:"cycle"};}};
  const termRoute="delivery/terms",termBody={centerId,code:"2026-Q4",displayName:"Q4 2026",startDate:"2026-10-01",endDate:"2026-12-31"};
  assert.equal((await handleBoWriteRequest(request(termRoute,true,termBody),env(binding),termRoute)).status,400);
  assert.equal((await handleBoWriteRequest(request(termRoute,true,termBody,"term-key"),env(binding),termRoute)).status,201);
  const weekRoute="delivery/term-weeks",weekBody={centerId,termId,code:"W01",ordinal:1,startDate:"2026-10-01",endDate:"2026-10-08",rhythmKey:"OPENING"};
  assert.equal((await handleBoWriteRequest(request(weekRoute,true,weekBody),env(binding),weekRoute)).status,400);
  assert.equal((await handleBoWriteRequest(request(weekRoute,true,weekBody,"week-key"),env(binding),weekRoute)).status,201);
  const updateRoute=`delivery/term-weeks/${weekId}/update`,updateBody={centerId,expectedUpdatedAt:"2026-10-01T00:00:00.000Z",code:"W01A",ordinal:1,startDate:"2026-10-01",endDate:"2026-10-08",rhythmKey:"BUILD"};
  assert.equal((await handleBoWriteRequest(request(updateRoute,true,updateBody),env(binding),updateRoute)).status,400);
  assert.equal((await handleBoWriteRequest(request(updateRoute,true,updateBody,"update-key"),env(binding),updateRoute)).status,200);
  const deleteRoute=`delivery/term-weeks/${weekId}/delete`,deleteBody={centerId,expectedUpdatedAt:"2026-10-02T00:00:00.000Z"};
  assert.equal((await handleBoWriteRequest(request(deleteRoute,true,deleteBody),env(binding),deleteRoute)).status,400);
  assert.equal((await handleBoWriteRequest(request(deleteRoute,true,deleteBody,"delete-key"),env(binding),deleteRoute)).status,200);
  const neutralizeRoute=`delivery/terms/${termId}/neutralize`,neutralizeBody={centerId,expectedUpdatedAt:"2026-10-01T00:00:00.000Z"};
  assert.equal((await handleBoWriteRequest(request(neutralizeRoute,true,neutralizeBody),env(binding),neutralizeRoute)).status,400);
  assert.equal((await handleBoWriteRequest(request(neutralizeRoute,true,neutralizeBody,"term-neutralize-key"),env(binding),neutralizeRoute)).status,200);
  assert.deepEqual(forwarded,[
    {method:"POST",path:termRoute,body:termBody,idempotencyKey:"term-key"},
    {method:"POST",path:weekRoute,body:weekBody,idempotencyKey:"week-key"},
    {method:"POST",path:updateRoute,body:updateBody,idempotencyKey:"update-key"},
    {method:"POST",path:deleteRoute,body:deleteBody,idempotencyKey:"delete-key"},
    {method:"POST",path:neutralizeRoute,body:neutralizeBody,idempotencyKey:"term-neutralize-key"},
  ]);
});

test("JCS05 delivery config lifecycle forwards only bounded status commands", async()=>{
  const id="0198d050-56c1-7ac5-b9ab-b0e45d912345",forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(coreRequest){forwarded.push(coreRequest);return{status:200,body:{data:{id,status:"ARCHIVED",version:2}},requestId:"lifecycle"};}};
  for(const route of [`delivery/learning-spaces/${id}/lifecycle`,`delivery/running-classes/${id}/lifecycle`]){
    const body={status:"ARCHIVED",expectedVersion:1};
    assert.equal((await handleBoWriteRequest(request(route,true,body),env(binding),route)).status,200);
  }
  assert.deepEqual(forwarded,[
    {method:"POST",path:`delivery/learning-spaces/${id}/lifecycle`,body:{status:"ARCHIVED",expectedVersion:1}},
    {method:"POST",path:`delivery/running-classes/${id}/lifecycle`,body:{status:"ARCHIVED",expectedVersion:1}},
  ]);
});

test("Student Intake void forwards exact bounded replay-protected command",async()=>{
  const studentId="0198d050-56c1-7ac5-b9ab-b0e45d912345",route=`student-intakes/${studentId}/void`,body={expectedStudentVersion:1,reason:"Erroneous intake"},forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(coreRequest){forwarded.push(coreRequest);return{status:200,body:{data:{studentProfileId:studentId,studentStatus:"ARCHIVED"}},requestId:"student-intake-void"};}};
  assert.equal((await handleBoWriteRequest(request(route,true,body),env(binding),route)).status,400);
  const response=await handleBoWriteRequest(request(route,true,body,"student-intake-void-key"),env(binding),route);
  assert.equal(response.status,200);
  assert.deepEqual(forwarded,[{method:"POST",path:route,body,idempotencyKey:"student-intake-void-key"}]);
  const broad=`student-intakes/${studentId}/void/extra`;
  assert.equal((await handleBoWriteRequest(request(broad,true,body,"bad"),env(binding),broad)).status,404);
  assert.equal(forwarded.length,1);
});

test("Session shared Syllabus binding write requires replay evidence and forwards only the bounded command",async()=>{const id="0198d050-56c1-7ac5-b9ab-b0e45d912345",version="0198d050-56c1-7ac5-b9ab-b0e45d954321",route=`delivery/sessions/${id}/syllabus-binding`,body={learningSyllabusVersionId:version,expectedSessionVersion:4,correctionReason:"Correct published lesson"},forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(coreRequest){forwarded.push(coreRequest);return{status:200,body:{data:{sessionId:id,learningSyllabusVersionId:version,sessionVersion:5}},requestId:"binding-write"};}};assert.equal((await handleBoStaffOnboardingRequest(request(route,true,body),env(binding),route)).status,400);assert.equal(forwarded.length,0);const response=await handleBoStaffOnboardingRequest(request(route,true,body,"binding-command"),env(binding),route);assert.equal(response.status,200);assert.deepEqual(forwarded,[{method:"POST",path:route,body,idempotencyKey:"binding-command"}]);});
test("timekeeping correction requires idempotency and forwards only through BO Core", async () => {
  const forwarded: Array<{ request: BoAccessRequest; token: string }> = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, token) { forwarded.push({ request, token }); return { status: 201, body: { data: { correction: { id: "c" } } }, requestId: "time-correct" }; } };
  const path = "workforce/timekeeping/01912345-6789-7abc-8def-0123456789ab/corrections";
  const missing = new Request(`https://bo.pinohouse.art/api/bo/${path}`, { method: "POST", headers: { cookie: `pino_staff_password_session=${token}` }, body: JSON.stringify({ correctionType: "CHECK_IN_AT" }) });
  assert.equal((await handleBoWriteRequest(missing, env(binding), path)).status, 400);
  const request = new Request(`https://bo.pinohouse.art/api/bo/${path}`, { method: "POST", headers: { cookie: `pino_staff_password_session=${token}`, "content-type": "application/json", "idempotency-key": "corr-key" }, body: JSON.stringify({ correctionType: "CHECK_IN_AT", correctedAt: "2026-09-06T01:15:00.000Z", reason: "Verified", expectedLatestCorrectionId: null }) });
  assert.equal((await handleBoWriteRequest(request, env(binding), path)).status, 201);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0]!.token, token);
  assert.deepEqual(forwarded[0]!.request, { method: "POST", path, body: { correctionType: "CHECK_IN_AT", correctedAt: "2026-09-06T01:15:00.000Z", reason: "Verified", expectedLatestCorrectionId: null }, idempotencyKey: "corr-key" });
});

test("missed checkout resolution requires idempotency and forwards exact Core command", async () => {
  const forwarded: Array<{ request: BoAccessRequest; token: string }> = [];
  const binding: BoAccessCoreBinding = { async executeWithStaffPassword(request, token) { forwarded.push({ request, token }); return { status: 200, body: { data: { session: { status: "CLOSED" } } }, requestId: "missed-checkout" }; } };
  const route = "workforce/timekeeping/01912345-6789-7abc-8def-0123456789ab/resolve-missed-checkout";
  assert.equal((await handleBoWriteRequest(request(route, true, { checkOutAt: "2026-09-06T04:30:00.000Z", reason: "Verified" }), env(binding), route)).status, 400);
  const response = await handleBoWriteRequest(request(route, true, { checkOutAt: "2026-09-06T04:30:00.000Z", reason: "Verified" }, "missed-key"), env(binding), route);
  assert.equal(response.status, 200);
  assert.equal(forwarded.length, 1);
  assert.deepEqual(forwarded[0]!.request, { method: "POST", path: route, body: { checkOutAt: "2026-09-06T04:30:00.000Z", reason: "Verified" }, idempotencyKey: "missed-key" });
});

test("calendar closure publication requires replay identity while archive forwards canonical optimistic versioning",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(coreRequest){forwarded.push(coreRequest);return{status:201,body:{data:{ok:true}},requestId:"closure"};}};const route="delivery/calendar-exclusions",body={centerId:"01912345-6789-7abc-8def-0123456789ab",scopeType:"HOUSE",startsOnLocalDate:"2030-09-04",endsBeforeLocalDate:"2030-09-05",reason:"PUBLIC_HOLIDAY"};assert.equal((await handleBoWriteRequest(request(route,true,body),env(binding),route)).status,400);assert.equal((await handleBoWriteRequest(request(route,true,body,"closure-key"),env(binding),route)).status,201);const id="0198d050-56c1-7ac5-b9ab-b0e45d912345",archive=`delivery/calendar-exclusions/${id}`,archiveBody={action:"archive",expectedVersion:1,archiveReason:"Corrected"};assert.equal((await handleBoWriteRequest(request(archive,true,archiveBody),env(binding),archive)).status,201);assert.deepEqual(forwarded,[{method:"POST",path:route,body,idempotencyKey:"closure-key"},{method:"POST",path:archive,body:archiveBody}]);});
