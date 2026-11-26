import test from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {middleware} from "../middleware";
import {HO_PAGE_PATHS,safeHoReturnTo,hoStagingReturnFromSearch,hoStagingAuthPath} from "./ho-routes";
import {safeBoStagingReturnTo,boStagingReturnFromSearch,boStagingAuthContinuation} from "./bo-staging-return-to";
import {recoverInvalidStaffPasswordSession} from "./staff-session-recovery";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const id="01a1ef9f-d253-7e6b-ba2d-200887c4486f";
const boHost="bo.staging.pinohouse.art",hoHost="ho.staging.pinohouse.art";
const lead="/bo/sales/leads";
const cases=[
 [boHost,lead+"?m1Preview=1",lead],
 [boHost,lead+"?m1Preview=1&quickView=LEAD-MOCK-001",lead+"?quickView=LEAD-MOCK-001"],
 [boHost,lead+"?quickView=LEAD-MOCK-001",lead+"?quickView=LEAD-MOCK-001"],
 [boHost,lead+"?m1Preview=1&lead=LEAD-MOCK-001&tab=members",lead+"?lead=LEAD-MOCK-001&tab=members"],
 [boHost,lead+"?lead=LEAD-MOCK-001&tab=members",lead+"?lead=LEAD-MOCK-001&tab=members"],
 [boHost,lead+"?centerId="+center+"&leadIntent="+id+"&q=music&sort=createdAt&dir=desc&size=50&f_status=SUBMITTED",lead+"?centerId="+center+"&leadIntent="+id+"&q=music&sort=createdAt&dir=desc&size=50&f_status=SUBMITTED"],
 [boHost,"/bo/piner-posts","/bo/piner-posts"],
 [boHost,"/bo/piner-posts?centerId="+center+"&record="+id+"&tab=media","/bo/piner-posts?centerId="+center+"&record="+id+"&tab=media"],
 [hoHost,HO_PAGE_PATHS.staffs+"?record="+id,HO_PAGE_PATHS.staffs+"?record="+id],
 [hoHost,HO_PAGE_PATHS.worlds+"?record="+id+"&tab=scenes",HO_PAGE_PATHS.worlds+"?record="+id+"&tab=scenes"],
 [hoHost,HO_PAGE_PATHS.customAttributes+"?sort=displayName&order=asc&size=30&page=2&entityType=Student&scope=CENTER&centerId="+center,HO_PAGE_PATHS.customAttributes+"?sort=displayName&order=asc&size=30&page=2&entityType=Student&scope=CENTER&centerId="+center],
];
test("PAP-2359: authored deep links survive anonymous login and tracking on both surfaces",()=>{
 for(const [host,path,expected] of cases){
  const parse=host===boHost?safeBoStagingReturnTo:safeHoReturnTo;
  assert.equal(parse(path),expected,path);
  const response=middleware(new NextRequest("https://"+host+path+(path.includes("?")?"&":"?")+"utm_source=chatgpt.com"));
  assert.equal(response.status,307,path);
  const dest=new URL(response.headers.get("location")!);
  assert.equal(dest.pathname,"/staff-login",path);
  assert.equal(dest.searchParams.get("returnTo"),expected,path);
  assert.equal(parse(dest.searchParams.get("returnTo")),expected,path);
  if(host===boHost)assert.equal(boStagingReturnFromSearch(new URL(boStagingAuthContinuation("/staff-password/change",dest.search),"https://"+host).search),expected);
 }
});
test("PAP-2359: all HO manifest paths survive campaign metadata",()=>{
 for(const path of ["/ho",...Object.values(HO_PAGE_PATHS)]){
  assert.equal(safeHoReturnTo(path+"?utm_source=chatgpt.com"),path);
 }
});
test("PAP-2359: preview, detail and filters remain route-bound and fail closed",()=>{
 for(const p of [lead+"?m1Preview=0",lead+"?m1Preview=1&m1Preview=1",lead+"?m1Preview=1&lead="+id,lead+"?lead="+id,lead+"?tab=members",lead+"?m1Preview=1&tab=members",lead+"?m1Preview=1&lead=LEAD-MOCK-001&quickView=LEAD-MOCK-001",lead+"?m1Preview=1&leadIntent="+id,lead+"?leadIntent=bad",lead+"?m1Preview=1&returnTo=//evil.example","/bo/enrollments?m1Preview=1","/bo/piner-posts?m1Preview=1&record="+id,lead+"?q=%00",lead+"?dir=wrong",lead+"?f___proto__=yes"]) assert.equal(safeBoStagingReturnTo(p),null,p);
 for(const p of [HO_PAGE_PATHS.worlds+"?tab=scenes",HO_PAGE_PATHS.worlds+"?record="+id+"&tab=unknown",HO_PAGE_PATHS.worlds+"?record="+id+"&tab=scenes&tab=history",HO_PAGE_PATHS.centers+"?tab=scenes",HO_PAGE_PATHS.customAttributes+"?size=999",HO_PAGE_PATHS.customAttributes+"?centerId=bad",HO_PAGE_PATHS.customAttributes+"?redirect=//evil.example"])assert.equal(safeHoReturnTo(p),null,p);
});
test("PAP-2359: expired client session returns to same HO/BO page, never production or other host",async()=>{
 for(const [hostname,path,expected] of cases){
  const urls:string[]=[];
  const url=new URL("https://"+hostname+path);
  await recoverInvalidStaffPasswordSession(async()=>new Response(null,{status:204}),{hostname,pathname:url.pathname,search:url.search,replace:v=>urls.push(String(v))});
  assert.equal(new URL(urls[0]!,"https://"+hostname).searchParams.get("returnTo"),expected,path);
 }
});

test("PAP-2359: HO password recovery retains one validated target and rejects duplicate returnTo",()=>{
 const target=HO_PAGE_PATHS.worlds+"?record="+id+"&tab=preview";
 const login=new URL(hoStagingAuthPath("/staff-login",target),"https://"+hoHost);
 const change=new URL(hoStagingAuthPath("/staff-password/change",hoStagingReturnFromSearch(login.search)),"https://"+hoHost);
 assert.equal(hoStagingReturnFromSearch(change.search),target);
 assert.equal(hoStagingReturnFromSearch(change.search+"&returnTo=%2Fho%2Fcenters"),null);
 assert.equal(safeHoReturnTo(HO_PAGE_PATHS.customAttributes+"?limit=10"),null);
});
test("PAP-2359: a session hint carries the same sanitized link; no preview on production hosts",()=>{
 for(const [host,path,expected] of cases){
  const result=middleware(new NextRequest("https://"+host+path+(path.includes("?")?"&":"?")+"utm_source=chatgpt.com",{headers:{cookie:"pino_staff_password_session=fixture-only"}}));
  assert.equal(result.headers.get("x-middleware-next"),"1",path);
  assert.equal(result.headers.get(host===boHost?"x-middleware-request-x-pino-bo-return-to":"x-middleware-request-x-pino-ho-return-to"),expected,path);
 }
 const response=middleware(new NextRequest("https://bo.pinohouse.art/bo/sales/leads?m1Preview=1"));
 assert.equal(new URL(response.headers.get("location")!).searchParams.get("returnTo"),null);
});
