import test from "node:test";
import assert from "node:assert/strict";
import {isBoPayrollDailyPath,parseBoPayrollDailyRead,handleBoPayrollDailyRead} from "./bo-payroll-daily-handler";

const ROOT="workforce/payroll/daily";
const CENTER="0199f001-0000-7000-8000-000000000001";
const STAFF="01a18a28-6d8e-7db7-acbb-a18a942a5e72";
const uri=(query:string)=>"https://bo.staging.pinohouse.art/api/bo/"+ROOT+query;
function check(query:string,method="GET"){
 return parseBoPayrollDailyRead(new Request(uri(query),{method}),ROOT);
}
test("PAP-1954 only the exact Daily GET collection and staff/day detail, never overrides",()=>{
 assert.equal(isBoPayrollDailyPath(ROOT),true);
 assert.equal(isBoPayrollDailyPath(ROOT+"/"+STAFF+"/2026-10-31"),true);
 assert.equal(isBoPayrollDailyPath(ROOT+"/"+STAFF+"/2026-10-31/overrides"),false);
 assert.equal(isBoPayrollDailyPath(ROOT+"/../../workforce"),false);
 assert.equal(isBoPayrollDailyPath("workforce/payroll/periods"),false);
});
test("PAP-1954 valid Center scoped date range sanitizes forwarded query",()=>{
 const result=check("?startDate=2026-10-01&endDate=2026-10-31&centerId="+CENTER+"&limit=25&offset=0&staffMemberId="+STAFF);
 assert.equal(result.ok,true);
 if(result.ok){
  assert.equal(result.centerId,CENTER);
  const params=new URLSearchParams(result.forwardPath.split("?")[1]);
  assert.deepEqual([...params.keys()],["centerId","startDate","endDate","staffMemberId","limit","offset"]);
  assert.equal(params.get("staffMemberId"),STAFF);
 }
});
test("PAP-1954 rejects absent/duplicate and spoofed Center",()=>{
 const base="&startDate=2026-10-01&endDate=2026-10-31";
 assert.equal(check("?startDate=2026-10-01&endDate=2026-10-31").ok,false);
 assert.equal(check("?centerId="+CENTER+"&centerId="+CENTER+base).ok,false);
 assert.equal(check("?centerId=xxx"+base).ok,false);
 assert.equal(check("?centerId="+CENTER+"&role=Founder"+base).ok,false);
});
test("PAP-1954 validates 31-day inclusive max and calendar dates",()=>{
 assert.equal(check("?centerId="+CENTER+"&startDate=2026-10-01&endDate=2026-10-31").ok,true);
 for(const q of [
  "startDate=2026-10-01&endDate=2026-11-01",
  "startDate=2026-10-31&endDate=2026-10-01",
  "startDate=2026-02-30&endDate=2026-03-01",
  "startDate=2026-02-01&endDate=2026-02-30",
  "startDate=2026-10-01&endDate=2026-10-31&startDate=2026-10-02",
 ])assert.equal(check("?centerId="+CENTER+"&"+q).ok,false,q);
});
test("PAP-1954 rejects invalid Staff, pagination, and malicious query fields",()=>{
 const p="?centerId="+CENTER+"&startDate=2026-10-01&endDate=2026-10-31";
 for(const q of ["&staffMemberId=not-a-uuid","&staffMemberId="+STAFF+"&staffMemberId="+STAFF,
  "&limit=0","&limit=101","&limit=1.5","&limit=001","&offset=-1",
  "&offset=1000001","&offset=0&offset=1","&amountMinor=999","&extra_time=1"])
  assert.equal(check(p+q).ok,false,q);
});
test("PAP-1954 detail validates workDate and only Center query",()=>{
 const good=ROOT+"/"+STAFF+"/2026-10-31";
 const value=parseBoPayrollDailyRead(new Request("https://bo.staging.pinohouse.art/api/bo/"+good+"?centerId="+CENTER),good);
 assert.equal(value.ok,true);
 const duplicate=parseBoPayrollDailyRead(new Request("https://bo.staging.pinohouse.art/api/bo/"+good+"?centerId="+CENTER+"&centerId="+CENTER),good);
 assert.equal(duplicate.ok,false);
 const badDate=ROOT+"/"+STAFF+"/2026-02-30";
 assert.equal(parseBoPayrollDailyRead(new Request("https://bo.staging.pinohouse.art/api/bo/"+badDate+"?centerId="+CENTER),badDate).ok,false);
 const injection=parseBoPayrollDailyRead(new Request("https://bo.staging.pinohouse.art/api/bo/"+good+"?centerId="+CENTER+"&limit=1"),good);
 assert.equal(injection.ok,false);
});
test("PAP-1954 local write methods are denied before credential/Core",async()=>{
 const p="?centerId="+CENTER+"&startDate=2026-10-01&endDate=2026-10-31";
 const parsed=check(p,"POST");
 assert.equal(parsed.ok,false);
 if(!parsed.ok)assert.equal(parsed.status,405);
 const denied=await handleBoPayrollDailyRead(new Request(uri(p),{method:"POST"}),{} as never,ROOT);
 assert.equal(denied.status,405);
 assert.equal(denied.headers.get("cache-control"),"no-store");
});
test("PAP-1954 invalid requests never reach Core or session",async()=>{
 const denied=await handleBoPayrollDailyRead(new Request(uri("?centerId="+CENTER)),{} as never,ROOT);
 assert.equal(denied.status,400);
 assert.equal((await denied.json()).error.code,"PLATFORM_INVALID_INPUT");
});
