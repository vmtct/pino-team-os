import test from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {middleware} from "../middleware";
import {BO_LEGACY_QUERY_MODULES} from "./bo-url-contract";
import {boStagingAdmittedRoutes} from "../app/bo/architecture/bo-staging-route-policy";
import {safeBoStagingReturnTo,boStagingReturnFromSearch,boStagingAuthContinuation,BO_RETURN_HEADER} from "./bo-staging-return-to";
import {recoverInvalidStaffPasswordSession} from "./staff-session-recovery";
const host="bo.staging.pinohouse.art",origin="https://"+host;
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5",record="01a1ef9f-d253-7e6b-ba2d-200887c4486f";
const sub="/bo?module=subscriptions&centerId="+center+"&record="+record+"&tab=enrollment",enrollment="/bo/enrollments?centerId="+center+"&record="+record;
test("PAP-2203: all admitted BO routes and typed detail survive cold login and forced-password continuation",()=>{
 const routes=["/bo",...BO_LEGACY_QUERY_MODULES.map(module=>"/bo?module="+module),...boStagingAdmittedRoutes,
 "/bo/payroll-daily/"+record+"/2026-11-19","/bo/payroll-exceptions/"+record,"/bo/opening-evidence/class/"+record,
 sub,enrollment,sub.replace("tab=enrollment","tab=specialty")+"&specialtyRecord="+record,
 "/bo/piner-posts?centerId="+center+"&record="+record+"&tab=media",
 "/bo/payroll-periods?centerId="+center+"&record="+record+"&incomeStaff="+record+"&incomeDay=2026-11-19&fromSettlement=1",
 "/bo/payroll-periods?centerId="+center+"&record="+record+"&tab=settlements&incomeDrawer="+record,
 "/bo/pinoria-wish-events?centerId="+center+"&record="+record+"&tab=items&wishCenter="+center+"&rewardOrdinal=1&rewardItem="+record+"&rewardRevision=1"];
 for(const path of routes){
  const canonical=safeBoStagingReturnTo(path);assert.ok(canonical,path);
  let r=middleware(new NextRequest(origin+path+(path.includes("?")?"&":"?")+"utm_source=chatgpt.com&utm_medium=referral"));
  for(let i=0;i<2&&new URL(r.headers.get("location")!).pathname!=="/staff-login";i++)r=middleware(new NextRequest(r.headers.get("location")!));
  assert.equal(r.status,307,path);const login=new URL(r.headers.get("location")!);
  assert.equal(login.pathname,"/staff-login",path);assert.equal(boStagingReturnFromSearch(login.search),canonical,path);
  const change=new URL(boStagingAuthContinuation("/staff-password/change",login.search),origin);
  assert.equal(boStagingReturnFromSearch(change.search),canonical);
  assert.equal(boStagingReturnFromSearch(new URL(boStagingAuthContinuation("/staff-login",change.search),origin).search),canonical);
  const present=middleware(new NextRequest(origin+canonical,{headers:{cookie:"pino_staff_password_session=fixture-only",[BO_RETURN_HEADER]:"/bo?module=students"}}));
  assert.equal(present.headers.get("x-middleware-next"),"1",canonical);
  assert.equal(present.headers.get("x-middleware-request-"+BO_RETURN_HEADER),canonical);
 }
});
test("PAP-2203: aliases canonicalize and never reinterpret retired Session identity",()=>{
 for(const [alias,expected] of [["/bo/subscriptions?centerId="+center+"&record="+record+"&tab=enrollment",sub],["/bo/registrations?centerId="+center+"&record="+record,"/bo/enrollments?centerId="+center],["/bo/open-studio","/bo/open-studio-passes"]]){
  const first=middleware(new NextRequest(origin+alias));assert.equal(first.status,307);
  const second=middleware(new NextRequest(first.headers.get("location")!));
  assert.equal(boStagingReturnFromSearch(new URL(second.headers.get("location")!).search),expected);
 }
});
test("PAP-2203: malicious, malformed and ambiguous returnTo rejected",()=>{
 for(const value of ["https://evil.example/bo","//evil.example/bo","/bo/../bo/enrollments","/bo%2fenrollments","/bo\\enrollments","/staff-login","/api/bo/context","/ho/centers","/bo/guest-unknown","/bo/students","/bo/tvs","/bo?module=bad","/bo?module=subscriptions&module=students",sub+"&record="+record,sub+"&returnTo=%2F%2Fevil.example",sub+"&centerId=evil",sub.replace("tab=enrollment","tab=unknown"),"/bo?module=subscriptions&tab=enrollment",sub+"&specialtyRecord="+record,enrollment+"#x","/bo/enrollments?centerId=bad","/bo/enrollments?search=%00","/bo/payroll-daily/"+record+"/2026-02-30","/bo/payroll-periods?incomeStaff="+record,"/bo/pinoria-wish-events?centerId="+center+"&record="+record+"&wishCenter="+record])assert.equal(safeBoStagingReturnTo(value),null,value);
 assert.equal(boStagingReturnFromSearch("?returnTo="+encodeURIComponent(sub)+"&returnTo="+encodeURIComponent(enrollment)),null);
});
test("PAP-2203: other hosts and invalid destinations do not acquire staging continuation",()=>{
 for(const [hostname,path] of [["bo.pinohouse.art","/bo"],[host,"/bo?module=bad"],[host,"/bo?module=subscriptions&centerId=bad"]]){
  const response=middleware(new NextRequest("https://"+hostname+path));assert.equal(response.status,307);
  const url=new URL(response.headers.get("location")!);assert.equal(url.pathname,"/staff-login");assert.equal(url.search,"");
 }
});
test("PAP-2203: expired session uses same safe target after existing cleanup",async()=>{
 const urls:string[]=[],calls:string[]=[];
 const fetcher:typeof fetch=async(input)=>{calls.push(String(input));return new Response(null,{status:204});};
 await recoverInvalidStaffPasswordSession(fetcher,{replace:v=>{urls.push(String(v));},hostname:host,pathname:"/bo",search:new URL(sub,origin).search});
 assert.deepEqual(calls,["/api/staff-auth/logout"]);assert.equal(boStagingReturnFromSearch(new URL(urls[0]!,origin).search),sub);
 await recoverInvalidStaffPasswordSession(fetcher,{replace:v=>{urls.push(String(v));},hostname:"bo.pinohouse.art",pathname:"/bo",search:"?module=subscriptions"});
 assert.equal(urls[1],"/staff-login");
});

test("PAP-2202: canonical and legacy Guest login continuation preserve exact selected Center",()=>{
 const canonical="/bo/guests?centerId="+center+"&record="+record;
 for(const route of [canonical,canonical.replace("/bo/guests","/bo/mytime-guests")]){
  assert.equal(safeBoStagingReturnTo(route),canonical);
  const response=middleware(new NextRequest(origin+route));assert.equal(response.status,307);
  const login=new URL(response.headers.get("location")!);assert.equal(login.pathname,"/staff-login");assert.equal(boStagingReturnFromSearch(login.search),canonical);
 }
});