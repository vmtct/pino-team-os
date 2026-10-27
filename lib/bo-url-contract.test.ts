import test from "node:test";
import assert from "node:assert/strict";
import {BO_LEGACY_QUERY_MODULES,BO_TARGET_ROUTES,assertBoTargetRegistry,
  buildBoTargetUrl,currentBoModuleHref,parseBoTargetUrl,targetForLegacyModule} from "./bo-url-contract";

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
  assert.equal(currentBoModuleHref("salaryPeriods",admitted),"/bo?module=salaryPeriods");
  assert.equal(currentBoModuleHref("workforce-shift-plans",admitted),"/bo/workforce-shift-plans");
  assert.equal(currentBoModuleHref("payroll-periods",admitted),"/bo/payroll-periods");
});

test("PAP-1091 guarded application auto-merge smoke: unknown resources stay denied",()=>{
  for(const slug of ["catalog","system/users","system/roles","legacy-termweek"])
    assert.equal(parseBoTargetUrl("/bo/"+slug),null,slug);
  assert.equal(targetForLegacyModule("catalog"),null);
});
