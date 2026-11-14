import test from "node:test";
import assert from "node:assert/strict";
import {nativeExceptionReadPath,handleNativeExceptionRead} from "./bo-payroll-exceptions-native-handler";
import type {BoPayrollReviewEnv} from "./bo-payroll-extra-review-handler";
const id="01a18a28-6d8e-7db7-acbb-a18a942a5e72";
const root="https://bo.staging.pinohouse.art/api/bo/workforce/payroll/read-only/extra-time/reviews";
const q="?centerId="+id+"&startDate=2026-11-01&endDate=2026-11-14";
test("PAP-1970 strict native review read maps to existing Core GET",()=>{
 assert.equal(nativeExceptionReadPath(new Request(root+q+"&limit=50&offset=0&status=PENDING")),"workforce/payroll/extra-time/reviews");
 assert.equal(nativeExceptionReadPath(new Request(root+"/"+id+"?centerId="+id),id),"workforce/payroll/extra-time/reviews/"+id);
 assert.equal(nativeExceptionReadPath(new Request(root+q+"&centerId="+id)),null);
 for(const bad of ["&status=ALL","&offset=-1","&limit=101","&staffId="+id,"&startDate=2026-11-01"])assert.equal(nativeExceptionReadPath(new Request(root+q+bad)),null);
 assert.equal(nativeExceptionReadPath(new Request(root+"?centerId="+id+"&startDate=2026-02-30&endDate=2026-03-01")),null);
});
test("PAP-1970 malformed or write requests fail before touching Core",async()=>{
 const inaccessible=new Proxy({},{get(){throw Error("Core must not be touched");}}) as BoPayrollReviewEnv;
 for(const request of [new Request(root+q+"&centerId="+id),new Request(root+"?centerId=invalid")])
  assert.equal((await handleNativeExceptionRead(request,inaccessible)).status,400);
 assert.equal((await handleNativeExceptionRead(new Request(root+q,{method:"POST"}),inaccessible)).status,405);
 assert.equal((await handleNativeExceptionRead(new Request(root+"/"+id+"?centerId="+id),inaccessible,"bad")).status,400);
});
