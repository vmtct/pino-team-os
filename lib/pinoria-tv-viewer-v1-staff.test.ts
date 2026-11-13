/** PAP-1646 / Epic PAP-650 PNR-TV — Staff Viewer authenticated F2 negative gates. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authorizedStaffViewerCenter, readStaffPublishedViewer,
  type StaffPolicyViewerEnv,
} from "./pinoria-tv-viewer-v1-staff";
import type { WorkforceRequest } from "./workforce-core";
import type { TosLearningRequest } from "./tos-learning-core";

const centerId = "0199ce43-781b-7e14-8a72-836a2925f8a8";
const otherCenter = "0199ce43-781b-7e14-8a72-836a2925f8a9";
const ref = "tvp1-center-" + centerId;
const ROOT = "https://tos.staging.pinohouse.art";
const events = ["ARRIVAL", "QUICK_CHOICE", "DEPARTURE", "WISH_REVEAL",
  "EGG_HATCH", "COMPANION_RITUAL", "ONBOARDING_CEREMONY"];
const context = (ids = [centerId]) => ({
  data: { userId: "staff-user", staffMemberId: "staff-1", founderMode: false,
    centers: ids.map(id => ({ id, key: "CAN", displayName: "Cần Thơ", timeZone: "Asia/Ho_Chi_Minh" })) },
});
function published() {
  return { data: { policyRef: ref, selectedCenterId: centerId,
    type: "Ambient Welcome", aspectRatio: "16:9", scope: "CENTER",
    effectiveScope: "CENTER", inherited: false, appliedRevision: 3,
    configuration: { schemaVersion: 1, quietMode: false,
      events: Object.fromEntries(events.map(kind => [kind, {
        enabled: true, priority: 50, maxAgeSeconds: 120, suppressInQuietMode: false,
      }])),
      visibleContext: { name: true, path: false, room: false,
        companion: true, pls: false, fruit: false, highlight: false },
    },
  } };
}
function setup(opts: {contextStatus?:number; publishedStatus?:number; contextBody?:unknown; publishedBody?:unknown}={}) {
  const workforce: WorkforceRequest[] = [];
  const tv: TosLearningRequest[] = [];
  const env: StaffPolicyViewerEnv = {
    APP_ENV: "staging",
    PINO_WORKFORCE_CORE: {
      async executeWithStaffPassword(request, token) {
        assert.equal(token, "session-token");
        workforce.push(request);
        return {status:opts.contextStatus??200,body:opts.contextBody??context(),requestId:"workforce"};
      },
    },
    PINO_TOS_LEARNING_CORE: {
      async executeWithStaffPassword(request, token) {
        assert.equal(token, "session-token");
        tv.push(request);
        return {status:opts.publishedStatus??200,body:Object.hasOwn(opts, "publishedBody") ? opts.publishedBody : published(),requestId:"policy"};
      },
    },
  };
  return {env,workforce,tv};
}
function request(path="/tv/p/"+ref,cookie="pino_staff_password_session=session-token",host="tos.staging.pinohouse.art") {
  return new Request(ROOT+path,{method:"GET",headers:{host,...(cookie?{cookie}:{})}});
}
test("PAP-1646 accepts the requested canonical Core-authorized Staff Center",()=>{
  assert.equal(authorizedStaffViewerCenter(context(),centerId),centerId);
  for(const invalid of [null,{},[],context([]),
    context(["bogus"]),{data:{...context().data,founderMode:true}},
    {data:{...context().data,staffMemberId:null}},
    {data:{...context().data,userId:""}},]) {
    assert.equal(authorizedStaffViewerCenter(invalid,centerId),null);
  }
});
test("PAP-1646 requires Workforce Core proof before published Core projection",async()=>{
  const {env,workforce,tv}=setup({contextBody:context([otherCenter,centerId])});
  const result=await readStaffPublishedViewer(request(),env,ref);
  assert.equal(result.kind,"published");
  if(result.kind!=="published") return;
  assert.equal(result.policy.appliedRevision,3);
  assert.equal(result.policy.selectedCenterId,centerId);
  assert.deepEqual(workforce,[{method:"GET",path:"/context",body:{}}]);
  assert.deepEqual(tv,[{method:"GET",path:"/pinoria/tv-policies/published",body:{centerId,policyRef:ref}}]);
});
test("PAP-1646 missing/expired Staff session cannot query Core published content",async()=>{
  const {env,workforce,tv}=setup();
  assert.deepEqual(await readStaffPublishedViewer(request(undefined,""),env,ref),{kind:"blocked",status:401});
  assert.equal(workforce.length,0);assert.equal(tv.length,0);
  const expired=setup({contextStatus:401});
  assert.deepEqual(await readStaffPublishedViewer(request(),expired.env,ref),{kind:"blocked",status:401});
  assert.equal(expired.tv.length,0);
});
test("PAP-1646 never accepts support-session as Staff Viewer authority",async()=>{
  const {env,workforce,tv}=setup();
  assert.deepEqual(await readStaffPublishedViewer(
    request(undefined,"pino_support_session=support; pino_staff_password_session=session-token"),env,ref),
    {kind:"blocked",status:403});
  assert.equal(workforce.length,0);assert.equal(tv.length,0);
});
test("PAP-1646 unauthorized Center never reaches published Core",async()=>{
  for(const body of [context([]),context([otherCenter])]) {
    const s=setup({contextBody:body});
    assert.deepEqual(await readStaffPublishedViewer(request(),s.env,ref),{kind:"blocked",status:403});
    assert.equal(s.tv.length,0);
  }
});
test("PAP-1646 direct DEFAULT cannot be used by TOS Staff even with session",async()=>{
  const {env,workforce,tv}=setup();
  const direct="tvp1-default";
  assert.deepEqual(await readStaffPublishedViewer(request("/tv/p/"+direct),env,direct),{kind:"blocked",status:403});
  assert.equal(workforce.length,0);assert.equal(tv.length,0);
});
test("PAP-1646 invalid/forged URL, query and hash fail before Core reads",async()=>{
  const {env,workforce,tv}=setup();
  for(const url of ["/tv/p/"+ref+"?centerId="+otherCenter,"/tv/p/"+ref+"#secret",
    "/tv/p/"+ref+"/","/tv/p/../../secret","/tv/p/tvp1-default","/tv/"+ref]) {
    const result=await readStaffPublishedViewer(request(url),env,ref);
    assert.equal(result.kind,"blocked",url);
  }
  assert.equal(workforce.length,0);assert.equal(tv.length,0);
});
test("PAP-1646 denies non-Staging host/APP_ENV even for valid session",async()=>{
  const s=setup();
  assert.deepEqual(await readStaffPublishedViewer(
    request(undefined,undefined,"tos.pinohouse.art"),s.env,ref),{kind:"blocked",status:404});
  assert.deepEqual(await readStaffPublishedViewer(request(),{...s.env,APP_ENV:"production"},ref),
    {kind:"blocked",status:404});
  assert.equal(s.workforce.length,0);assert.equal(s.tv.length,0);
});
test("PAP-1646 missing Core binding is not a preview bypass",async()=>{
  assert.deepEqual(await readStaffPublishedViewer(request(),{APP_ENV:"staging"},ref),
    {kind:"blocked",status:503});
});
test("PAP-1646 Core explicit 403 permission/foreign Center never renders",async()=>{
  for(const status of [401,403,404,500]) {
    const s=setup({publishedStatus:status});
    const response=await readStaffPublishedViewer(request(),s.env,ref);
    assert.deepEqual(response,{kind:"blocked",status:status===500?503:status});
  }
});
test("PAP-1646 malformed 200 projection is still denied, not auth bypass",async()=>{
  for(const invalid of [null,{}, {data:{...published().data,selectedCenterId:otherCenter}},
    {data:{...published().data,privateStudentName:"leak"}},
    {data:{...published().data,appliedRevision:0}},
  ]) {
    const s=setup({publishedBody:invalid});
    assert.deepEqual(await readStaffPublishedViewer(request(),s.env,ref),
      {kind:"blocked",status:503});
  }
});
test("PAP-1646 no source-side mutation or privileged bypass",async()=>{
  const s=setup();
  const result=await readStaffPublishedViewer(request(),s.env,ref);
  assert.equal(result.kind,"published");
  assert.equal(s.workforce.length,1);assert.equal(s.tv.length,1);
  assert.deepEqual(s.tv[0],{method:"GET",path:"/pinoria/tv-policies/published",
    body:{centerId,policyRef:ref}});
});
