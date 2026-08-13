import test from"node:test";import assert from"node:assert/strict";import{bookingDefaults,expectedStart,isoFromLocal,OFFER_LABELS,pathName}from"./founder-model";
test("canonical Path projection drives labels",()=>assert.equal(pathName([{id:"p",code:"ART",displayName:"Art",status:"active"}],"p"),"Art"));
test("booking defaults open now and close one hour before a future session",()=>{const now=new Date("2026-08-13T00:00:00Z"),start=new Date("2026-08-13T05:00:00Z"),result=bookingDefaults(start,now);assert.equal(result.manual,false);assert.ok(result.bookingClosesAt)});
test("booking within 60 minutes requires explicit values",()=>{const now=new Date("2026-08-13T04:30:00Z"),start=new Date("2026-08-13T05:00:00Z");assert.deepEqual(bookingDefaults(start,now),{bookingOpensAt:"",bookingClosesAt:"",manual:true})});
test("session expected time uses PINO UTC+7 and transport uses ISO",()=>assert.equal(isoFromLocal("2026-08-14T09:30"),new Date("2026-08-14T09:30").toISOString()));
test("all canonical offers have distinct display labels",()=>assert.deepEqual(Object.keys(OFFER_LABELS),["explore","trial_premium","premium_home"]));
test("expected start preserves local date and recurring time",()=>assert.equal(expectedStart("2026-08-14","09:30").toISOString(),"2026-08-14T02:30:00.000Z"));
