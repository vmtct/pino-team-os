import test from"node:test";
import assert from"node:assert/strict";
import{tosLearningApi}from"./tos-learning-api";

test("sessionsDay calls only the TOS learning facade with Center and local date",async()=>{
 const calls:unknown[][]=[];const original=globalThis.fetch;
 globalThis.fetch=(async(...args:Parameters<typeof fetch>)=>{calls.push(args as unknown[]);return Response.json({data:{centerId:"center-1",localDate:"2026-08-28",sessions:[]}});})as typeof fetch;
 try{await tosLearningApi.sessionsDay("center-1","2026-08-28");}finally{globalThis.fetch=original;}
 const[url,init]=calls[0] as[string,RequestInit];assert.equal(url,"/api/tos-learning/sessions/day?centerId=center-1&localDate=2026-08-28");assert.equal(init.cache,"no-store");
});

test("recurring settlement sends Enrollment authority without client Subscription guess",async()=>{
 const calls:unknown[][]=[];const original=globalThis.fetch,recordedAt="2026-08-28T03:15:00.000Z";
 globalThis.fetch=(async(...args:Parameters<typeof fetch>)=>{calls.push(args as unknown[]);return Response.json({data:{participation:{id:"p",commercialConsequence:"CONSUME_SERVICE_UNIT"},attendance:{id:"a",status:"PRESENT",version:1},diary:{id:"d",version:1}}},{status:201});})as typeof fetch;
 try{await tosLearningApi.settleRecurring({studentProfileId:"student-1",sessionId:"session-1",enrollmentId:"enrollment-1",attendanceStatus:"PRESENT",recordedAt,diary:{syllabusId:"syllabus-1",learningOwnerStaffId:"staff-1"}});}finally{globalThis.fetch=original;}
 const[url,init]=calls[0] as[string,RequestInit];assert.equal(url,"/api/tos-learning/participation/settle");assert.equal(init.method,"POST");assert.equal(new Headers(init.headers).get("idempotency-key"),`classroom-recurring-v1:session-1:student-1:PRESENT:${recordedAt}`);
 const body=JSON.parse(String(init.body));assert.deepEqual(body,{studentProfileId:"student-1",sessionId:"session-1",basis:"RECURRING",enrollmentId:"enrollment-1",attendanceStatus:"PRESENT",recordedAt,diary:{syllabusId:"syllabus-1",learningOwnerStaffId:"staff-1"}});assert.equal("subscriptionId"in body,false);
});
