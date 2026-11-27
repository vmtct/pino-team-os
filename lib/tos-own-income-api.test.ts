import test from "node:test";
import assert from "node:assert/strict";
import {ownDailyIncome,OwnIncomeApiError} from "./tos-own-income-api";

test("PAP-2429 daily read uses Staff-self range, preserves integer VND and null, never caches",async t=>{
 const rows=[{workDate:"2026-11-01",status:"DRAFT",calculationStatus:"READY",paidMinutes:180,
  standardMinor:75000,extraTimeMinor:0,extraTimePending:true,amountMinor:null}];
 const mocked=t.mock.method(globalThis,"fetch",async (..._args:Parameters<typeof fetch>)=>Response.json({data:{data:rows}}));
 assert.deepEqual(await ownDailyIncome("center","2026-11-01","2026-11-30"),{data:rows});
 assert.equal(mocked.mock.calls[0]?.arguments[0],"/api/tos-learning/workforce/payroll/income/daily?centerId=center&startDate=2026-11-01&endDate=2026-11-30");
 assert.deepEqual(mocked.mock.calls[0]?.arguments[1],{method:"GET",cache:"no-store",headers:{"cache-control":"no-store"}});
});
test("PAP-2429 daily API denies missing or unauthorized data rather than returning fake empty rows",async t=>{
 const mocked=t.mock.method(globalThis,"fetch",async()=>Response.json({error:{message:"Forbidden"}},{status:403}));
 await assert.rejects(ownDailyIncome("center","2026-11-01","2026-11-30"),(e:unknown)=>e instanceof OwnIncomeApiError&&e.status===403);
 mocked.mock.mockImplementation(async()=>Response.json({data:{}}));
 await assert.rejects(ownDailyIncome("center","2026-11-01","2026-11-30"),OwnIncomeApiError);
});