import test from "node:test";
import assert from "node:assert/strict";
import {toExceptionReadRow,validExceptionRange,minorVnd} from "./bo-payroll-exceptions-model";
import {exceptionReadApi} from "./bo-payroll-exceptions-read";
import type {ReviewedException} from "./bo-payroll-extra-review-api";
const center="0199f001-0000-7000-8000-000000000001";
const sample:ReviewedException={
 id:"00000000-0000-7000-8000-000000000099",centerId:center,
 staffMemberId:"01a18a28-6d8e-7db7-acbb-a18a942a5e72",
 assignmentId:"00000000-0000-7000-8000-000000000008",workDate:"2026-11-13",
 requestedStartAt:"2026-11-13T11:00:00Z",requestedEndAt:"2026-11-13T12:00:00Z",
 requestReason:"requested extra time",status:"PENDING",decision:null,
};
test("PAP-1955 request is read-only and does not invent Staff/legal Submitted By/audit",()=>{
 const p=toExceptionReadRow(sample,center);
 assert.deepEqual([p.staffLegalName,p.submittedBy,p.createdAt,p.createdBy,p.updatedAt,p.updatedBy],Array(6).fill("—"));
 assert.equal(p.requestedWindow,"18:00 – 19:00");
 assert.equal(p.reviewedAmountMinor,null);
});
test("PAP-1955 approved minutes and amount are strictly Core decision (no FE calculation)",()=>{
 const decision={id:"decision-id",type:"APPROVED" as const,startAt:"2026-11-13T11:15:00Z",
 endAt:"2026-11-13T11:30:00Z",minutes:15,hourlyRateMinor:50000,
 rateEntryId:"rate",rateVersion:2,amountMinor:12500,reason:"verified adjustment",
 reviewerId:"user-id",reviewedAt:"2026-11-13T13:00:00Z",sourceFingerprint:"abc"};
 const p=toExceptionReadRow({...sample,status:"APPROVED",decision},center);
 assert.equal(p.reviewedMinutes,15);
 assert.equal(p.reviewedAmountMinor,12500);
 assert.equal(p.reviewerName,"—");
 assert.equal(p.reviewerId,"user-id");
 assert.deepEqual([p.createdAt,p.createdBy,p.updatedAt,p.updatedBy],["—","—","—","—"]);
 assert.equal(minorVnd(p.reviewedAmountMinor),"12.500 ₫");
});
test("PAP-1955 reject and withdrawn never render invented wage",()=>{
 const reject={...sample,status:"REJECTED" as const,decision:{
  id:"id",type:"REJECTED" as const,startAt:null,endAt:null,minutes:null,
  hourlyRateMinor:null,rateEntryId:null,rateVersion:null,amountMinor:null,
  reason:"rejected",reviewerId:"user-id",reviewedAt:"2026-11-13T13:00:00Z",
  sourceFingerprint:null}};
 assert.equal(toExceptionReadRow(reject,center).reviewedAmountMinor,null);
 assert.equal(toExceptionReadRow({...sample,status:"WITHDRAWN"},center).reviewedMinutes,null);
 assert.equal(minorVnd(null),"—");
});
test("PAP-1955 rejects Core cross-Center response",()=>{
 assert.throws(()=>toExceptionReadRow(sample,"other"),/CROSS_CENTER/);
});
test("PAP-1955 inclusive 91-day date guard",()=>{
 assert.equal(validExceptionRange("2026-09-01","2026-11-30"),true);
 for(const [a,b] of [["2026-09-01","2026-12-01"],["2026-02-30","2026-03-01"],
  ["2026-11-14","2026-11-13"],["2026-11-01","2026-11-99"]])
  assert.equal(validExceptionRange(a,b),false);
});
test("PAP-1955 read client always GET, no mutation contract",async()=>{
 const calls:{url:string;method:string}[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  calls.push({url:String(input),method:init?.method??"GET"});
  return Response.json({data:String(input).includes("/reviews/")?sample:{data:[sample],total:1,nextOffset:null}});
 };
 const list=await exceptionReadApi.list({centerId:center,startDate:"2026-11-01",endDate:"2026-11-13",limit:20,offset:0},fetcher);
 const detail=await exceptionReadApi.detail(center,sample.id,fetcher);
 assert.equal(list.data.total,1);
 assert.equal(detail.data.id,sample.id);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.method==="GET"));
 assert.ok(calls.every(c=>c.url.includes("centerId="+center)));
 assert.equal("decide" in exceptionReadApi,false);
});
