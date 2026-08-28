import test from"node:test";
import assert from"node:assert/strict";
import{tosLearningApi}from"./tos-learning-api";

test("sessionsDay calls only the TOS learning facade with Center and local date",async()=>{
 const calls:unknown[][]=[];const original=globalThis.fetch;
 globalThis.fetch=(async(...args:Parameters<typeof fetch>)=>{calls.push(args as unknown[]);return Response.json({data:{centerId:"center-1",localDate:"2026-08-28",sessions:[]}});})as typeof fetch;
 try{await tosLearningApi.sessionsDay("center-1","2026-08-28");}finally{globalThis.fetch=original;}
 const[url,init]=calls[0] as[string,RequestInit];assert.equal(url,"/api/tos-learning/sessions/day?centerId=center-1&localDate=2026-08-28");assert.equal(init.cache,"no-store");
});

test("classroom learning client exposes read contracts only",()=>{
 assert.deepEqual(Object.keys(tosLearningApi).sort(),["learningOptions","roster","sessionsDay"]);
});
