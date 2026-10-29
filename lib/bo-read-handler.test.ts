import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest, isPracticeReadPath, type BoReadEnv } from "./bo-read-handler";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";
const token="local-password-session";
const req=(path:string,authenticated=true,method="GET")=>new Request(`https://bo.pinohouse.art/api/bo/${path}?email=forged&userId=forged`,{method,headers:authenticated?{cookie:`pino_staff_password_session=${token}`}:{}});
const env=(binding:BoAccessCoreBinding):BoReadEnv=>({PINO_BO_CORE:binding});
test("BO reads forward exact bounded requests with local password session",async()=>{const forwarded:Array<{request:BoAccessRequest;token:string}>=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request,value){forwarded.push({request,token:value});return{status:200,body:{data:[]},requestId:"read"};}};const paths=["delivery/bootstrap-state","running-classes","practice/resources","workforce/staff-registration-settings","pinoria/effects/catalog"];for(const path of paths)assert.equal((await handleBoOperationalReadRequest(req(path),env(binding),path)).status,200);assert.deepEqual(forwarded.map(x=>x.request),paths.map(path=>({method:"GET",path})));assert.ok(forwarded.every(x=>x.token===token));});
test("PAP-982 Self Directory BFF admits only authenticated bounded CENTER read", async () => {
  const forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:{items:[],nextCursor:null}},requestId:"self-dir"};}};
  const centerId="01912345-6789-7abc-8def-0123456789ab",path="pinoria/avatars";
  const request=(query:string, authenticated=true)=>new Request("https://bo.staging.pinohouse.art/api/bo/"+path+query,{headers:authenticated?{cookie:"pino_staff_password_session="+token}:{}});
  const ok=await handleBoOperationalReadRequest(request("?centerId="+centerId+"&limit=25&q=Mai&subjectType=STAFF&avatarStatus=SELF_MISSING"),env(binding),path);
  assert.equal(ok.status,200);assert.equal(ok.headers.get("x-request-id"),"self-dir");
  assert.deepEqual(forwarded,[{method:"GET",path,resource:{centerId},body:{limit:25,q:"Mai",subjectType:"STAFF",avatarStatus:"SELF_MISSING"}}]);
  assert.equal((await handleBoOperationalReadRequest(request("?limit=100"),env(binding),path)).status,200);
  assert.deepEqual(forwarded[1],{method:"GET",path,body:{limit:100}});
  for (const query of ["?centerId=forged","?centerId="+centerId+"&centerId="+centerId,"?limit=0","?limit=101","?limit=01","?cursor=","?subjectType=GOD","?subjectStatus=invalid","?avatarStatus=CHARACTER_MISSING","?userId=forged","?q=%0A"]) {
    assert.equal((await handleBoOperationalReadRequest(request(query),env(binding),path)).status,400,query);
  }
  assert.equal((await handleBoOperationalReadRequest(request("?centerId="+centerId,false),env(binding),path)).status,401);
  assert.equal((await handleBoOperationalReadRequest(request(""),env(binding),"pinoria/avatars/extra")).status,404);
  assert.equal(forwarded.length,2);
});
test("missing local password session fails before Core",async()=>{let called=false;const binding:BoAccessCoreBinding={async executeWithStaffPassword(){called=true;throw new Error("unexpected");}};assert.equal((await handleBoOperationalReadRequest(req("sessions",false),env(binding),"sessions")).status,401);assert.equal(called,false);});
test("unknown paths and non-GET methods fail closed",async()=>{let called=false;const binding:BoAccessCoreBinding={async executeWithStaffPassword(){called=true;throw new Error("unexpected");}};assert.equal((await handleBoOperationalReadRequest(req("bookings"),env(binding),"bookings")).status,404);assert.equal((await handleBoOperationalReadRequest(req("sessions",true,"POST"),env(binding),"sessions")).status,405);assert.equal(called,false);});
test("learner directory preserves only the explicit Center resource and bounded query fields",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:[]},requestId:"learners"};}};const centerId="01912345-6789-7abc-8def-0123456789ab";const request=new Request(`https://bo.pinohouse.art/api/bo/learners?centerId=${centerId}&query=Mai&limit=20&offset=200&userId=forged&pathId=forged`,{headers:{cookie:`pino_staff_password_session=${token}`}});await handleBoOperationalReadRequest(request,env(binding),"learners");assert.deepEqual(forwarded,[{method:"GET",path:"learners",resource:{centerId},body:{query:"Mai",limit:20,offset:200}}]);});
test("learner directory does not invent a Center resource when centerId is absent or blank",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:[]},requestId:"learners-global"};}};for(const suffix of ["?query=Mai","?centerId=%20%20&query=Mai"]){const request=new Request(`https://bo.pinohouse.art/api/bo/learners${suffix}`,{headers:{cookie:`pino_staff_password_session=${token}`}});await handleBoOperationalReadRequest(request,env(binding),"learners");}assert.deepEqual(forwarded,[{method:"GET",path:"learners",body:{query:"Mai"}},{method:"GET",path:"learners",body:{query:"Mai"}}]);});
test("Open Studio learner lookup forwards Center scope without widening learner query fields",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:[]},requestId:"open-learners"};}};const centerId="01912345-6789-7abc-8def-0123456789ab";const request=new Request(`https://bo.pinohouse.art/api/bo/open-studio/learners?centerId=${centerId}&query=Mai&limit=10&userId=forged`,{headers:{cookie:`pino_staff_password_session=${token}`}});await handleBoOperationalReadRequest(request,env(binding),"open-studio/learners");assert.deepEqual(forwarded,[{method:"GET",path:"open-studio/learners",resource:{centerId},body:{query:"Mai",limit:10}}]);});
test("learner lifecycle detail preserves explicit Center resource without adding it to the body",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:{}},requestId:"learner-detail"};}};const studentId="01912345-6789-7abc-8def-0123456789ab",centerId="01922345-6789-7abc-8def-0123456789ab";const request=new Request(`https://bo.pinohouse.art/api/bo/students/${studentId}/lifecycle?centerId=${centerId}&effectiveAt=forged`,{headers:{cookie:`pino_staff_password_session=${token}`}});await handleBoOperationalReadRequest(request,env(binding),`students/${studentId}/lifecycle`);assert.deepEqual(forwarded,[{method:"GET",path:`students/${studentId}/lifecycle`,resource:{centerId}}]);});
test("Open Studio learner lifecycle detail preserves the same explicit Center resource",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:{}},requestId:"open-learner-detail"};}};const studentId="01912345-6789-7abc-8def-0123456789ab",centerId="01922345-6789-7abc-8def-0123456789ab";const request=new Request(`https://bo.pinohouse.art/api/bo/open-studio/students/${studentId}/lifecycle?centerId=${centerId}`,{headers:{cookie:`pino_staff_password_session=${token}`}});await handleBoOperationalReadRequest(request,env(binding),`open-studio/students/${studentId}/lifecycle`);assert.deepEqual(forwarded,[{method:"GET",path:`open-studio/students/${studentId}/lifecycle`,resource:{centerId}}]);});
test("Core denial and request id pass through",async()=>{const binding:BoAccessCoreBinding={async executeWithStaffPassword(){return{status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"denied"};}};const response=await handleBoOperationalReadRequest(req("running-classes"),env(binding),"running-classes");assert.equal(response.status,403);assert.equal(response.headers.get("x-request-id"),"denied");});
test("Practice read allowlist remains bounded",()=>{assert.equal(isPracticeReadPath("practice/repertoire-access/context"),true);assert.equal(isPracticeReadPath("practice/repertoire-access"),true);assert.equal(isPracticeReadPath("practice/repertoire-access/grants"),false);});

test("Session shared Syllabus binding read stays exact and bounded",async()=>{const id="0198d050-56c1-7ac5-b9ab-b0e45d912345",path=`delivery/sessions/${id}/syllabus-binding`,forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:{sessionId:id,bindingState:"UNBOUND"}},requestId:"binding-read"};}};const response=await handleBoOperationalReadRequest(req(path),env(binding),path);assert.equal(response.status,200);assert.deepEqual(forwarded,[{method:"GET",path}]);assert.equal((await handleBoOperationalReadRequest(req(`delivery/sessions/${id}/syllabus-binding/extra`),env(binding),`delivery/sessions/${id}/syllabus-binding/extra`)).status,404);});
test("timekeeping Center bootstrap forwards the dedicated scoped Core read",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:[{id:"01912345-6789-7abc-8def-0123456789ab",displayLabel:"Cần Thơ",timeZone:"Asia/Ho_Chi_Minh"}]},requestId:"tk-centers"};}};const request=new Request("https://bo.pinohouse.art/api/bo/workforce/timekeeping/centers",{headers:{cookie:`pino_staff_password_session=${token}`}});const response=await handleBoOperationalReadRequest(request,env(binding),"workforce/timekeeping/centers");assert.equal(response.status,200);assert.deepEqual(forwarded,[{method:"GET",path:"workforce/timekeeping/centers"}]);});
test("timekeeping read forwards only bounded canonical filters",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:{data:[],nextCursor:null,summary:{totalSessions:0,openSessions:0,closedSessions:0}}},requestId:"tk"};}};const request=new Request("https://bo.pinohouse.art/api/bo/workforce/timekeeping?centerId=01912345-6789-7abc-8def-0123456789ab&startDate=2026-09-01&endDate=2026-09-06&staffMemberId=01912345-6789-7abc-8def-0123456789ac&status=CLOSED&limit=25&cursor=abc&userId=forged&email=forged",{headers:{cookie:`pino_staff_password_session=${token}`}});const response=await handleBoOperationalReadRequest(request,env(binding),"workforce/timekeeping");assert.equal(response.status,200);assert.deepEqual(forwarded,[{method:"GET",path:"workforce/timekeeping",body:{centerId:"01912345-6789-7abc-8def-0123456789ab",startDate:"2026-09-01",endDate:"2026-09-06",staffMemberId:"01912345-6789-7abc-8def-0123456789ac",status:"CLOSED",cursor:"abc",limit:25}}]);});

test("calendar closure reads forward only bounded impact filters",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:[]},requestId:"calendar"};}};const centerId="01912345-6789-7abc-8def-0123456789ab",url=new Request(`https://bo.pinohouse.art/api/bo/delivery/calendar-exclusions/preview?centerId=${centerId}&scopeType=HOUSE&startsOnLocalDate=2030-09-04&endsBeforeLocalDate=2030-09-05&effectiveAt=2029-12-01T00%3A00%3A00.000Z&userId=forged`,{headers:{cookie:`pino_staff_password_session=${token}`}});assert.equal((await handleBoOperationalReadRequest(url,env(binding),"delivery/calendar-exclusions/preview")).status,200);assert.deepEqual(forwarded,[{method:"GET",path:"delivery/calendar-exclusions/preview",body:{centerId,scopeType:"HOUSE",startsOnLocalDate:"2030-09-04",endsBeforeLocalDate:"2030-09-05",effectiveAt:"2029-12-01T00:00:00.000Z"}}]);});

test("calendar scope bootstrap is admitted and forwarded to the canonical Core route",async()=>{const forwarded:BoAccessRequest[]=[];const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:{centers:[],paths:[],runningClasses:[]}},requestId:"calendar-scope"};}};const response=await handleBoOperationalReadRequest(req("delivery/calendar-scope"),env(binding),"delivery/calendar-scope");assert.equal(response.status,200);assert.deepEqual(forwarded,[{method:"GET",path:"delivery/calendar-scope"}]);assert.equal((await handleBoOperationalReadRequest(req("delivery/calendar-scope/extra"),env(binding),"delivery/calendar-scope/extra")).status,404);});


test("PAP-863: Missions read forwards only catalog filters, never caller identity", async () => {
  const forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){
    forwarded.push(request);return {status:200,body:{data:[]},requestId:"missions"};
  }};
  const request = new Request("https://bo.pinohouse.art/api/bo/learning/missions?search=Art&status=ACTIVE&level=2&limit=25&offset=0&userId=spoofed",{
    headers:{cookie:"pino_staff_password_session="+token}
  });
  const response = await handleBoOperationalReadRequest(request,env(binding),"learning/missions");
  assert.equal(response.status,200);
  assert.deepEqual(forwarded,[{method:"GET",path:"learning/missions?search=Art&status=ACTIVE&level=2&limit=25&offset=0"}]);
});

test("PAP-863: private TV policy reads pass bounded scope to Core, deny invalid scope", async () => {
  const forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){
    forwarded.push(request);return{status:200,body:{data:null},requestId:"tv-policy"};
  }};
  const centerId="0198d050-56c1-7ac5-b9ab-b0e45d912345";
  const request = new Request("https://bo.pinohouse.art/api/bo/pinoria/tv-config/policy/head?scope=CENTER&centerId="+centerId,{
    headers:{cookie:"pino_staff_password_session="+token}
  });
  assert.equal((await handleBoOperationalReadRequest(request,env(binding),"pinoria/tv-config/policy/head")).status,200);
  assert.deepEqual(forwarded,[{method:"GET",path:"pinoria/tv-config/policy/head",body:{scope:{kind:"CENTER",centerId}}}]);
  const bad = new Request("https://bo.pinohouse.art/api/bo/pinoria/tv-config/policy/head?scope=EVERYONE",{
    headers:{cookie:"pino_staff_password_session="+token}
  });
  assert.equal((await handleBoOperationalReadRequest(bad,env(binding),"pinoria/tv-config/policy/head")).status,400);
  assert.equal(forwarded.length,1);
});

test("PAP-893: BO session roster read is bounded, authenticated, and Core-authorized",async()=>{
  const id="01912345-6789-7abc-8def-0123456789ab",path=`sessions/${id}/roster`;
  const forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:403,body:{error:{code:"ACCESS_PERMISSION_DENIED"}},requestId:"roster-denied"};}};
  const response=await handleBoOperationalReadRequest(req(path),env(binding),path);
  assert.equal(response.status,403);
  assert.equal(response.headers.get("x-request-id"),"roster-denied");
  assert.deepEqual(forwarded,[{method:"GET",path}]);
  for(const bad of [`sessions/not-an-id/roster`,`sessions/${id}/roster/extra`,`sessions/${id}/attendance`]){
    assert.equal((await handleBoOperationalReadRequest(req(bad),env(binding),bad)).status,404);
  }
  assert.equal((await handleBoOperationalReadRequest(req(path,false),env(binding),path)).status,401);
  assert.equal(forwarded.length,1);
});

test("PAP-1029: Parent Directory facade forwards only canonical bounded pagination and rejects privacy bypass", async () => {
  const forwarded: BoAccessRequest[] = [];
  const binding: BoAccessCoreBinding = {
    async executeWithStaffPassword(request) {
      forwarded.push(request);
      return { status: 200, body: { data: { items: [], total: 0 } }, requestId: "parents" };
    },
  };
  const path = "identity/parents/directory";
  const request = (query: string) => new Request("https://bo.pinohouse.art/api/bo/" + path + query, {
    headers: { cookie: "pino_staff_password_session=" + token },
  });
  const success = await handleBoOperationalReadRequest(request("?limit=25&offset=0"), env(binding), path);
  assert.equal(success.status, 200);
  assert.deepEqual(forwarded, [{ method: "GET", path, body: { limit: 25, offset: 0 } }]);
  for (const query of [
    "?limit=25&limit=40", "?offset=1&offset=2", "?unmasked=true", "?centerId=forged",
    "?limit=0", "?limit=101", "?offset=-1", "?offset=10001", "?limit=1.5",
    "?limit=", "?limit=01", "?limit=999999999999999999999999999",
  ]) {
    const response = await handleBoOperationalReadRequest(request(query), env(binding), path);
    assert.equal(response.status, 400, query);
  }
  assert.equal(forwarded.length, 1);
});


test("delivery scope catalog forwards only a validated explicit Center and never invents GLOBAL authority",async()=>{
  const forwarded:BoAccessRequest[]=[];
  const binding:BoAccessCoreBinding={async executeWithStaffPassword(request){forwarded.push(request);return{status:200,body:{data:{centers:[]}},requestId:"center-scope"};}};
  const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
  const request=new Request(`https://bo.staging.pinohouse.art/api/bo/delivery/bootstrap-state?centerId=${centerId}&userId=forged`,{headers:{cookie:`pino_staff_password_session=${token}`}});
  assert.equal((await handleBoOperationalReadRequest(request,env(binding),"delivery/bootstrap-state")).status,200);
  assert.deepEqual(forwarded,[{method:"GET",path:"delivery/bootstrap-state",resource:{centerId}}]);
  const bad=new Request("https://bo.staging.pinohouse.art/api/bo/delivery/bootstrap-state?centerId=not-a-center",{headers:{cookie:`pino_staff_password_session=${token}`}});
  assert.equal((await handleBoOperationalReadRequest(bad,env(binding),"delivery/bootstrap-state")).status,400);
  assert.equal(forwarded.length,1);
});
