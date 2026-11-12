/** PAP-1646 / Epic PAP-650 PNR-TV — HTTP statuses, not Next streaming RSC. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blockedPolicyViewerHttp, handlePolicyViewerHttp,
} from "./pinoria-tv-viewer-v1-http";
import type { StaffPolicyViewerEnv } from "./pinoria-tv-viewer-v1-staff";

const centerId = "0199ce43-781b-7e14-8a72-836a2925f8a8";
const ref = "tvp1-center-" + centerId;
const url = "https://tos.staging.pinohouse.art/tv/p/" + ref;
const context = (centers=[centerId]) => ({data:{userId:"staff-user",staffMemberId:"staff-1",
  founderMode:false,centers:centers.map(id=>({id,key:"CT",displayName:"Center",timeZone:"Asia/Ho_Chi_Minh"}))}});
const events=["ARRIVAL","QUICK_CHOICE","DEPARTURE","WISH_REVEAL","EGG_HATCH","COMPANION_RITUAL","ONBOARDING_CEREMONY"];
function projection() {
  return {data:{
    policyRef:ref,selectedCenterId:centerId,type:"Ambient Welcome",aspectRatio:"16:9",
    scope:"CENTER",effectiveScope:"CENTER",inherited:false,appliedRevision:3,
    configuration:{schemaVersion:1,quietMode:true,
      events:Object.fromEntries(events.map(k=>[k,{
        enabled:true,priority:50,maxAgeSeconds:120,suppressInQuietMode:false,
      }])),
      visibleContext:{name:false,path:false,room:false,companion:false,
        pls:false,fruit:false,highlight:false},
    },
  }};
}
function setup(opts:{authStatus?:number;policyStatus?:number;centers?:string[];
  policyBody?:unknown}={}) {
  const calls:string[]=[];
  const env:StaffPolicyViewerEnv={
    APP_ENV:"staging",
    PINO_WORKFORCE_CORE:{async executeWithStaffPassword(req,token){
      assert.equal(token,"synthetic-token");calls.push("workforce:"+req.path);
      return {status:opts.authStatus??200,body:context(opts.centers),requestId:"workforce"};
    }},
    PINO_TOS_LEARNING_CORE:{async executeWithStaffPassword(req,token){
      assert.equal(token,"synthetic-token");calls.push("policy:"+req.path);
      return {status:opts.policyStatus??200,body:Object.hasOwn(opts,"policyBody")?opts.policyBody:projection(),
        requestId:"policy"};
    }},
  };
  return {env,calls};
}
function request(u=url,cookie="pino_staff_password_session=synthetic-token"){
  return new Request(u,{headers:{host:"tos.staging.pinohouse.art",...(cookie?{cookie}:{})}});
}
test("PAP-1646 no cookie is a true 401 Response, never 200 streaming redirect",async()=>{
  const s=setup();const r=await handlePolicyViewerHttp(request(url,""),s.env,ref);
  assert.equal(r.status,401);
  assert.equal(r.headers.get("cache-control"),"private, no-store, max-age=0");
  assert.equal(r.headers.get("x-content-type-options"),"nosniff");
  assert.deepEqual(s.calls,[]);
  const body=await r.text();
  assert.match(body,/Cần đăng nhập/);
  assert.doesNotMatch(body,/data-pnr-tv-published-policy|NEXT_REDIRECT|session-token/);
});
test("PAP-1646 invalid cookie Core 401 is a true 401 HTTP code",async()=>{
  const s=setup({authStatus:401});const r=await handlePolicyViewerHttp(request(),s.env,ref);
  assert.equal(r.status,401);assert.deepEqual(s.calls,["workforce:/context"]);
  assert.doesNotMatch(await r.text(),/data-pnr-tv-published-policy/);
});
test("PAP-1646 Core policy permission denied is HTTP 403, never synthetic 200",async()=>{
  const s=setup({policyStatus:403});const r=await handlePolicyViewerHttp(request(),s.env,ref);
  assert.equal(r.status,403);assert.equal(s.calls.length,2);
  assert.doesNotMatch(await r.text(),/data-pnr-tv-published-policy|NEXT_REDIRECT/);
});
test("PAP-1646 correct 404 and 503 statuses for no Policy or transport unavailable",async()=>{
  for(const [status,expected] of [[404,404],[500,503]] as const){
    const s=setup({policyStatus:status});const r=await handlePolicyViewerHttp(request(),s.env,ref);
    assert.equal(r.status,expected);
    assert.doesNotMatch(await r.text(),/data-pnr-tv-published-policy/);
  }
});
test("PAP-1646 invalid canonical ref and forged query are HTTP 404 before Core",async()=>{
  for(const [u,target] of [[url+"?centerId=forged",ref],[url,"invalid-ref"]] as const){
    const s=setup();const r=await handlePolicyViewerHttp(request(u),s.env,target);
    assert.equal(r.status,404);assert.deepEqual(s.calls,[]);
  }
});
test("PAP-1646 multicenter Staff is HTTP 403 before published Core",async()=>{
  const s=setup({centers:[centerId,"0199ce43-781b-7e14-8a72-836a2925f8a9"]});
  const r=await handlePolicyViewerHttp(request(),s.env,ref);
  assert.equal(r.status,403);assert.deepEqual(s.calls,["workforce:/context"]);
});
test("PAP-1646 untrusted HO/nonstage host gets 404, never creates content",async()=>{
  const s=setup();const bad=new Request(url,{
    headers:{host:"ho.staging.pinohouse.art",cookie:"pino_staff_password_session=synthetic-token"}});
  assert.equal((await handlePolicyViewerHttp(bad,s.env,ref)).status,404);
  assert.equal((await handlePolicyViewerHttp(request(),{...s.env,APP_ENV:"production"},ref)).status,404);
  assert.deepEqual(s.calls,[]);
});
test("PAP-1646 malformed Core 200 is HTTP 503, not viewed Policy",async()=>{
  const s=setup({policyBody:{data:{...projection().data,deviceId:"private"}}});
  const r=await handlePolicyViewerHttp(request(),s.env,ref);
  assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/data-pnr-tv-published-policy/);
});
test("PAP-1646 200 HTML only after BOTH Core gates, no private runtime payload",async()=>{
  const s=setup();const r=await handlePolicyViewerHttp(request(),s.env,ref);
  assert.equal(r.status,200);
  assert.deepEqual(s.calls,["workforce:/context","policy:/pinoria/tv-policies/published"]);
  const body=await r.text();
  assert.match(body,/data-pnr-tv-published-policy="authorized"/);
  assert.match(body,/data-pnr-tv-frame="16:9"/);
  assert.match(body,/Phiên bản 3/);
  assert.match(body,/Chế độ yên tĩnh/);
  assert.doesNotMatch(body,/0199ce43|synthetic-token|staff-user|<script|NEXT_REDIRECT/);
  assert.match(r.headers.get("content-security-policy")??"",/default-src 'none'/);
  assert.equal(r.headers.get("x-frame-options"),"DENY");
});
test("PAP-1646 explicit blocked HTTP response never misreports 200",async()=>{
  for(const status of [401,403,404,503] as const){
    const r=blockedPolicyViewerHttp(status);
    assert.equal(r.status,status);
    assert.equal(r.headers.get("content-type"),"text/html; charset=utf-8");
    assert.doesNotMatch(await r.text(),/data-pnr-tv-published-policy|NEXT_REDIRECT/);
  }
});
