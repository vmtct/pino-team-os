import test from "node:test";
import assert from "node:assert/strict";
import {shiftWeek,assignmentHours,formatIncome,incomeBreakdown,shiftRoleLabel} from "./tos-vnext-shift-view-model";
import type {Assignment} from "./workforce-api";
test("center-local carousel spans seven days across month and year boundaries",()=>{
 assert.deepEqual(shiftWeek("2027-01-01").map(x=>x.date),["2026-12-28","2026-12-29","2026-12-30","2026-12-31","2027-01-01","2027-01-02","2027-01-03"]);
 assert.equal(shiftWeek("2026-10-26")[0].label,"T2");
 for(const invalid of ["2026-02-30","2026-13-01","x","2026-1-01"])assert.throws(()=>shiftWeek(invalid));
});
test("schedule times and role facts come from Core, including custom ranges",()=>{
 const row={effectiveStartLocal:"2026-10-26T18:30:00",effectiveEndLocal:"2026-10-26T21:00:00",shift:{startLocalTime:"18:00:00",endLocalTime:"22:00:00"},roleAssignments:[{roleType:"TEACHER"}]} as Assignment;
 assert.equal(assignmentHours(row),"18:30–21:00");
 assert.equal(assignmentHours({...row,effectiveStartLocal:null,effectiveEndLocal:null}),"18:00–22:00");
 assert.equal(shiftRoleLabel(row),"Giáo viên");
 assert.equal(shiftRoleLabel({...row,roleAssignments:undefined}),"Chưa có vai trò được phân công");
});
test("unknown income stays unknown; zero and negative adjustments remain server facts",()=>{
 assert.equal(formatIncome(undefined),"—");assert.equal(formatIncome(null),"—");
 assert.match(formatIncome(0),/0/);assert.match(formatIncome(-50000),/-50\.000/);
});

test("PAP-2136 renders identical integer VND from BO and TOS, without /100",()=>{for(const amount of [62400,12500,0,-50000])assert.equal(formatIncome(amount),new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(amount));});

test("PAP-2429 period breakdown includes exact approved extra-time and preserves unavailable amounts",()=>{
 const period={periodId:"period",name:"November",startDate:"2026-11-01",endDate:"2026-11-30",status:"DRAFT",amountMinor:62400,standardMinor:50000,extraTimeMinor:12500,adjustmentsMinor:-100,paidMinutes:120,warnings:[],finalizedAt:null,paidAt:null,paymentDate:null,estimateAvailable:true} as const;
 assert.deepEqual(incomeBreakdown({...period,warnings:[]}).map(x=>x[1]),[50000,12500,-100]);
 assert.deepEqual(incomeBreakdown({...period,warnings:[],extraTimeMinor:0}).map(x=>x[1]),[50000,0,-100]);
 assert.equal(incomeBreakdown({...period,warnings:[],extraTimeMinor:null})[1][1],null);
 assert.deepEqual(incomeBreakdown(undefined).map(x=>x[1]),[undefined,undefined,undefined]);
});