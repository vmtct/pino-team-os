import test from "node:test";
import assert from "node:assert/strict";
import {isBoPayrollPeriodPath,handleBoPayrollPeriodRequest} from "./bo-payroll-period-handler";
import {validPeriodInput,money} from "./bo-payroll-period-api";
const center="a57d77f0-d217-4af6-afb9-fc41b6751209",period="1cddf9e6-2ef4-42b2-8d50-74dcab97c9f8";
const staff="a93e1220-05d2-4f17-b937-cd2bdba5204e";
const base="https://test.local/api/bo/";
test("PAP-808 allowlist excludes generic and other-staff endpoints",()=>{
 const routes=["workforce/payroll/periods","workforce/payroll/periods/"+period,
  "workforce/payroll/periods/"+period+"/staff-rollup",
  "workforce/payroll/periods/"+period+"/settlements",
  "workforce/payroll/periods/"+period+"/staff/"+staff+"/preview",
  "workforce/payroll/periods/"+period+"/staff/"+staff+"/finalize",
  "workforce/payroll/settlements/"+period+"/paid"];
 routes.forEach(path=>assert.equal(isBoPayrollPeriodPath(path),true,path));
 ["workforce/payroll/periods/all/delete","workforce/payroll/periods/"+period+"/delete",
  "workforce/payroll/settlements","workforce/payroll/periods/"+period+"/staff/"+staff+"/delete",
  "staff/"+staff+"/income"].forEach(path=>assert.equal(isBoPayrollPeriodPath(path),false,path));
});
test("PAP-808 date contract validates order and prevents empty name",()=>{
 assert.equal(validPeriodInput({name:"Tháng 10",startDate:"2026-10-01",endDate:"2026-10-31"}),true);
 assert.equal(validPeriodInput({name:"",startDate:"2026-10-01",endDate:"2026-10-31"}),false);
 assert.equal(validPeriodInput({name:"Tháng 10",startDate:"2026-11-01",endDate:"2026-10-31"}),false);
 assert.equal(money(250000),"250.000 ₫");
});
const env={} as Parameters<typeof handleBoPayrollPeriodRequest>[1];
test("PAP-808 facade rejects missing center before credential or Core",async()=>{
 const path="workforce/payroll/periods";
 const response=await handleBoPayrollPeriodRequest(new Request(base+path),env,path);
 assert.equal(response.status,400);
});
test("PAP-808 facade rejects cross-center write before credential or Core",async()=>{
 const path="workforce/payroll/periods";
 const response=await handleBoPayrollPeriodRequest(new Request(base+path+"?centerId="+center,{
  method:"POST",headers:{"content-type":"application/json","idempotency-key":"test-create-123"},
  body:JSON.stringify({centerId:period,name:"October",startDate:"2026-10-01",endDate:"2026-10-31"})
 }),env,path);
 assert.equal(response.status,400);
});
test("PAP-808 facade rejects finalize without exact fingerprint and warnings",async()=>{
 const path="workforce/payroll/periods/"+period+"/staff/"+staff+"/finalize";
 const response=await handleBoPayrollPeriodRequest(new Request(base+path+"?centerId="+center,{
  method:"POST",headers:{"content-type":"application/json","idempotency-key":"test-final-123"},
  body:JSON.stringify({centerId:center,expectedFingerprint:"forged",acknowledgedWarnings:[]})
 }),env,path);
 assert.equal(response.status,400);
});
test("PAP-808 facade rejects unsafe payment without reference",async()=>{
 const path="workforce/payroll/settlements/"+period+"/paid";
 const response=await handleBoPayrollPeriodRequest(new Request(base+path+"?centerId="+center,{
  method:"POST",headers:{"content-type":"application/json","idempotency-key":"test-paid-123"},
  body:JSON.stringify({centerId:center,paymentDate:"2026-10-20",paymentReference:""})
 }),env,path);
 assert.equal(response.status,400);
});
