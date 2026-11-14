import test from "node:test";
import assert from "node:assert/strict";
import {isBoPayrollPeriodPath,handleBoPayrollPeriodRequest} from "./bo-payroll-period-handler";
import {validPeriodInput,money,periodApi} from "./bo-payroll-period-api";
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

test("PAP-1985 native dates commands omit name and preserve replay key and CAS",async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const original=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{
  calls.push({url:String(input),init:init??{}});
  return Response.json({data:{}});
 };
 try{
  const dates={startDate:"2026-10-01",endDate:"2026-10-31",name:"spoof"};
  await periodApi.createDates(center,dates,"test-create-123");
  await periodApi.editDates(center,{id:period,version:7},dates);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)),{centerId:center,startDate:dates.startDate,endDate:dates.endDate});
  assert.equal(new Headers(calls[0].init.headers).get("idempotency-key"),"test-create-123");
  assert.equal(calls[1].init.method,"PATCH");
  assert.deepEqual(JSON.parse(String(calls[1].init.body)),{centerId:center,startDate:dates.startDate,endDate:dates.endDate,expectedVersion:7});
 }finally{globalThis.fetch=original;}
});
test("PAP-1985 date-only write retains CAS and date validation before authorization",async()=>{
 const path="workforce/payroll/periods/"+period;
 for(const body of [
  {centerId:center,startDate:"2026-10-01",endDate:"2026-10-31"},
  {centerId:center,startDate:"2026-11-01",endDate:"2026-10-31",expectedVersion:1},
 ]){
  const response=await handleBoPayrollPeriodRequest(new Request(base+path+"?centerId="+center,{
   method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)
  }),env,path);
  assert.equal(response.status,400);
 }
});test("PAP-1990 cancellation exact route, CAS, idempotency and no DELETE",async()=>{
 const id="0199f001-0000-7000-8000-000000000001";
 const path="workforce/payroll/periods/"+id+"/cancel";
 assert.equal(isBoPayrollPeriodPath(path),true);
 assert.equal(isBoPayrollPeriodPath(path+"/other"),false);
 assert.equal(isBoPayrollPeriodPath("workforce/payroll/periods/"+period+"/cancel"),false);
 for(const [method,query,body,key,status] of [
  ["DELETE","?centerId="+center,undefined,"test-key-1",405],
  ["POST","?centerId="+center,{centerId:center},"test-key-1",400],
  ["POST","?centerId="+center,{centerId:center,expectedVersion:1,force:true},"test-key-1",400],
  ["POST","?centerId="+center+"&centerId="+period,{centerId:center,expectedVersion:1},"test-key-1",400],
  ["POST","?centerId="+center,{centerId:period,expectedVersion:1},"test-key-1",400],
  ["POST","?centerId="+center,{centerId:center,expectedVersion:1},"short",400],
 ] as const){
  const res=await handleBoPayrollPeriodRequest(new Request(base+path+query,{method,headers:{"idempotency-key":key},...(body?{body:JSON.stringify(body)}:{})}),env,path);
  assert.equal(res.status,status);
 }
 const original=globalThis.fetch;
 globalThis.fetch=async(input,init)=>{
  assert.equal(String(input),"/api/bo/workforce/payroll/periods/"+id+"/cancel?centerId="+center);
  assert.equal(init?.method,"POST");assert.equal(new Headers(init?.headers).get("idempotency-key"),"test-cancel-key");
  assert.deepEqual(JSON.parse(String(init?.body)),{centerId:center,expectedVersion:7});
  return Response.json({data:{}});
 };
 try{await periodApi.cancel(center,{id,version:7},"test-cancel-key");}finally{globalThis.fetch=original;}
});
