import test from "node:test";
import assert from "node:assert/strict";
import {BO_LEGACY_QUERY_MODULES,BO_TARGET_ROUTES,assertBoTargetRegistry,
  buildBoTargetUrl,currentBoModuleHref,parseBoTargetUrl,targetForLegacyModule,retiredSalaryPeriodRedirectUrl} from "./bo-url-contract";

test("PAP-1089 target paths and aliases do not conflate domain identities",()=>{
  assert.doesNotThrow(assertBoTargetRegistry);
  assert.equal(new Set(BO_TARGET_ROUTES.map(r=>r.path)).size,BO_TARGET_ROUTES.length);
  assert.equal(new Set(BO_LEGACY_QUERY_MODULES).size,BO_LEGACY_QUERY_MODULES.length);
  assert.equal(targetForLegacyModule("students"),"students");
  assert.equal(targetForLegacyModule("subscriptions"),"subscriptions");
  for(const alias of ["classes","staffs","salaryPeriods","enrollments","visits"])
    assert.equal(targetForLegacyModule(alias),null);
});

test("PAP-1089 builds and parses Table/Drawer/Detail business tab with state",()=>{
  assert.equal(buildBoTargetUrl({moduleKey:"students",surface:"table"}),"/bo/students");
  assert.equal(buildBoTargetUrl({moduleKey:"students",surface:"drawer",recordId:"student-123",
    query:{centerId:"c1",search:"Anne"}}),"/bo/students?centerId=c1&search=Anne&record=student-123");
  const detail="/bo/students/student-123?view=active&tab=subscriptions";
  assert.equal(buildBoTargetUrl({moduleKey:"students",surface:"detail",recordId:"student-123",
    tab:"subscriptions",query:{view:"active"}}),detail);
  assert.deepEqual(parseBoTargetUrl("/bo/students/student-123","?view=active&tab=subscriptions"),{
    moduleKey:"students",surface:"detail",recordId:"student-123",tab:"subscriptions",query:{view:"active"}});
  assert.deepEqual(parseBoTargetUrl("/bo/students","?record=student-123"),{
    moduleKey:"students",surface:"drawer",recordId:"student-123"});
  assert.deepEqual(parseBoTargetUrl("/bo/parents/p_123","?tab=history"),{
    moduleKey:"parents",surface:"detail",recordId:"p_123",tab:"history"});
});

test("PAP-1089 denies malformed URLs, duplicate query, unknown tab and PII parameters",()=>{
  for(const path of ["/bo/unknown","/ho/students","/bo/students/..","/bo/students/a%2Fb",
    "/bo/students/123/extra"]) assert.equal(parseBoTargetUrl(path),null,path);
  for(const [path,search] of [
    ["/bo/students","?record=x&record=y"],
    ["/bo/students","?record="],
    ["/bo/students/123","?record=456"],
    ["/bo/students","?tab=history"],
    ["/bo/students/123","?tab=payroll"],
    ["/bo/subscriptions/123","?tab=contacts"],
    ["/bo/students","?password=123"],
    ["/bo/students","?view=a&view=b"],
  ]) assert.equal(parseBoTargetUrl(path,search),null,path+search);
  assert.throws(()=>buildBoTargetUrl({moduleKey:"students",surface:"drawer",recordId:"a/b"}));
  assert.throws(()=>buildBoTargetUrl({moduleKey:"students",surface:"detail",tab:"history"}));
  assert.throws(()=>buildBoTargetUrl({moduleKey:"students",surface:"table",recordId:"x"}));
  assert.throws(()=>buildBoTargetUrl({moduleKey:"students",surface:"table",query:{token:"xyz"}}));
});

test("PAP-1089 current nav URLs remain identical until explicit route admission",()=>{
  const admitted={"workforce-shift-plans":"/bo/workforce-shift-plans","payroll-periods":"/bo/payroll-periods"};
  assert.equal(currentBoModuleHref("students",admitted),"/bo");
  assert.equal(currentBoModuleHref("parents",admitted),"/bo?module=parents");
  assert.equal(currentBoModuleHref("subscriptions",admitted),"/bo?module=subscriptions");
  assert.equal(currentBoModuleHref("classes",admitted),"/bo?module=classes");
  assert.equal(currentBoModuleHref("salaryPeriods",admitted),"/bo/payroll-periods");
  assert.equal(currentBoModuleHref("workforce-shift-plans",admitted),"/bo/workforce-shift-plans");
  assert.equal(currentBoModuleHref("payroll-periods",admitted),"/bo/payroll-periods");
});

test("PAP-1091 guarded application auto-merge smoke: unknown resources stay denied",()=>{
  for(const slug of ["catalog","system/users","system/roles","legacy-termweek"])
    assert.equal(parseBoTargetUrl("/bo/"+slug),null,slug);
  assert.equal(targetForLegacyModule("catalog"),null);
});


test("PAP-1158 retired Salary Period URL goes to canonical Kỳ lương",()=>{
  const id="01a171ed-eb78-7941-b1de-dd4c020457b7";
  const center="0199f001-0000-7000-8000-000000000001";
  assert.equal(retiredSalaryPeriodRedirectUrl({module:"salaryPeriods"}),"/bo/payroll-periods");
  assert.equal(retiredSalaryPeriodRedirectUrl({module:"salaryPeriods",record:id}),"/bo/payroll-periods?record="+id);
  assert.equal(retiredSalaryPeriodRedirectUrl({module:"salaryPeriods",record:id,centerId:center}),"/bo/payroll-periods?record="+id+"&centerId="+center);
  assert.equal(retiredSalaryPeriodRedirectUrl({module:"salaryPeriods",record:["a","b"],centerId:"bad/path",password:"secret"}),"/bo/payroll-periods");
  assert.equal(targetForLegacyModule("salaryPeriods"),null,"Do not conflate old and new domain identity");
  assert.deepEqual(parseBoTargetUrl("/bo/payroll-periods","?record="+id),{moduleKey:"payroll-periods",surface:"drawer",recordId:id});
});

test("PAP-1220 Classroom Diary staging TDD uses the canonical BO target registry, no alias leakage",()=>{
  const route=BO_TARGET_ROUTES.find(r=>r.key==="classroom-diaries");
  assert.deepEqual(route,{key:"classroom-diaries",path:"/bo/classroom-diaries",tabs:["overview","history"]});
  assert.equal(buildBoTargetUrl({moduleKey:"classroom-diaries",surface:"table"}),"/bo/classroom-diaries");
  assert.deepEqual(parseBoTargetUrl("/bo/classroom-diaries"),{moduleKey:"classroom-diaries",surface:"table"});
  assert.equal(targetForLegacyModule("classroom-diaries"),null,"new route cannot appear as old BO query module");
  assert.equal(parseBoTargetUrl("/bo/classroom-diaries/../staff"),null);
  assert.equal(parseBoTargetUrl("/ho/classroom-diaries"),null);
});

test("PAP-1220 shared TDD navigation admits the real BO Staging Diary pathname, never Production",async()=>{
  const {browserTddNavigation}=await import("./workspace-adapters/navigation");
  const {diaryQuery}=await import("../app/bo/classroom-diaries/schema");
  const previous=Object.getOwnPropertyDescriptor(globalThis,"location");
  try{
    Object.defineProperty(globalThis,"location",{configurable:true,value:{
      hostname:"bo.staging.pinohouse.art",host:"bo.staging.pinohouse.art",origin:"https://bo.staging.pinohouse.art",
      pathname:"/bo/classroom-diaries",search:"",href:"https://bo.staging.pinohouse.art/bo/classroom-diaries"}});
    assert.doesNotThrow(()=>browserTddNavigation("BO","classroom-diaries",diaryQuery));
    Object.defineProperty(globalThis,"location",{configurable:true,value:{
      hostname:"bo.pinohouse.art",host:"bo.pinohouse.art",origin:"https://bo.pinohouse.art",
      pathname:"/bo/classroom-diaries",search:"",href:"https://bo.pinohouse.art/bo/classroom-diaries"}});
    assert.throws(()=>browserTddNavigation("BO","classroom-diaries",diaryQuery),/route mismatch/);
  }finally{
    if(previous)Object.defineProperty(globalThis,"location",previous);
    else Reflect.deleteProperty(globalThis,"location");
  }
});
