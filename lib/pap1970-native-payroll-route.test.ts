import test from "node:test";
import assert from "node:assert/strict";
import {nativePayrollModule,isNativePayrollApi,isNativePayrollNamespace} from "./bo-native-payroll-route";
import {decideHostBoundary} from "./host-boundary";
import {isBoStagingRouteAdmitted} from "../app/bo/architecture/bo-staging-route-policy";
const id="01a18a28-6d8e-7db7-acbb-a18a942a5e72";
const host="bo.staging.pinohouse.art";
const pages=["/bo/payroll-daily","/bo/payroll-daily/"+id+"/2026-11-14","/bo/payroll-exceptions","/bo/payroll-exceptions/"+id];
const apis=["/api/bo/workforce/payroll/daily","/api/bo/workforce/payroll/daily/"+id+"/2026-11-14","/api/bo/workforce/payroll/read-only/extra-time/reviews","/api/bo/workforce/payroll/read-only/extra-time/reviews/"+id];
const malformed=["/bo/payroll-daily/"+id+"/2026-02-30","/bo/payroll-daily/invalid/2026-11-14","/bo/payroll-exceptions/"+id+"/extra","/bo/payroll-exceptions/bogus","/api/bo/workforce/payroll/daily/"+id+"/2026-02-30","/api/bo/workforce/payroll/read-only/extra-time/reviews/"+id+"/decision"];
test("PAP-1970 native pages match exactly the admitted read-only route grammar",()=>{
 for(const page of pages){assert.ok(nativePayrollModule(page));assert.ok(isBoStagingRouteAdmitted(page));assert.equal(decideHostBoundary(host,page).action,"next");}
 for(const bad of malformed){assert.ok(isNativePayrollNamespace(bad));assert.equal(nativePayrollModule(bad),null);assert.equal(isNativePayrollApi(bad),false);assert.equal(isBoStagingRouteAdmitted(bad),false);assert.equal(decideHostBoundary(host,bad).action,"not_found");}
 assert.equal(nativePayrollModule("/bo/payroll-periods"),null);
 assert.equal(isBoStagingRouteAdmitted("/bo/payroll-periods"),true);
});
test("PAP-1970 only canonical BO Staging gets page GET/HEAD and API GET; no writers or cross-host admission",()=>{
 for(const page of pages){
  assert.equal(decideHostBoundary(host,page,"HEAD").action,"next");
  assert.equal(decideHostBoundary(host,page,"POST").action,"not_found");
 }
 for(const api of apis){assert.ok(isNativePayrollApi(api));assert.equal(decideHostBoundary(host,api,"GET").action,"next");for(const method of ["POST","PATCH","PUT","DELETE","HEAD"])assert.equal(decideHostBoundary(host,api,method).action,"not_found");}
 for(const foreign of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art","unknown.example","pino-team-os-staging.minhtri-van42.workers.dev"])
  for(const route of [...pages,...apis])assert.equal(decideHostBoundary(foreign,route,"GET").action,"not_found");
});
