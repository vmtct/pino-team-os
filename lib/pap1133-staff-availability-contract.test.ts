import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {workforceApi} from "./workforce-api";

const centerId="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const termWeekId="01a17d3f-72cd-7cb1-94a7-79f99f90f4db";
test("PAP-1133: all five Staff availability API operations carry the canonical Center and TermWeek",async()=>{
 const original=globalThis.fetch;
 const calls:Array<{path:string;method:string;body:Record<string,unknown>|null}>=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  calls.push({path:String(input),method:init?.method??"GET",body:init?.body?JSON.parse(String(init.body)):null});
  return new Response(JSON.stringify({data:{}}),{status:200,headers:{"content-type":"application/json"}});
 }) as typeof fetch;
 try{
  await workforceApi.availability(centerId,termWeekId);
  await workforceApi.availabilityWindow(centerId,termWeekId);
  await workforceApi.availabilityDraft(centerId,termWeekId);
  await workforceApi.replaceAvailability({centerId,termWeekId,submissionId:"submission-qa",expectedVersion:4,items:[{workDate:"2026-11-17",shiftTemplateId:"template-qa"}]});
  await workforceApi.submitAvailability({centerId,termWeekId,submissionId:"submission-qa",expectedVersion:5});
 }finally{globalThis.fetch=original}
 assert.equal(calls.length,5);
 for(const entry of calls){
  if(entry.method==="GET"){
   const params=new URL(entry.path,"https://tos.staging.pinohouse.art").searchParams;
   assert.equal(params.get("centerId"),centerId);
   assert.equal(params.get("termWeekId"),termWeekId);
  }else{
   assert.equal(entry.body?.centerId,centerId);
   assert.equal(entry.body?.termWeekId,termWeekId);
  }
 }
 assert.deepEqual(calls.map(c=>c.method),["GET","GET","POST","PUT","POST"]);
 assert.equal(calls[3].body?.expectedVersion,4);
 assert.equal(calls[4].body?.expectedVersion,5);
 assert.deepEqual(calls[3].body?.items,[{workDate:"2026-11-17",shiftTemplateId:"template-qa"}]);
});

test("PAP-1133: Staff workspace scopes reads and writes to the authorized Center",async()=>{
 const ui=await readFile("app/components/WorkforceWorkspace.tsx","utf8");
 assert.match(ui,/workforceApi\.availability\(center\.id,availabilityWeek\.id\)/);
 assert.match(ui,/workforceApi\.availabilityWindow\(center\.id,availabilityWeek\.id\)/);
 assert.match(ui,/workforceApi\.availabilityDraft\(center\.id,availabilityWeek\.id\)/);
 assert.match(ui,/availability\.centerId !== center\.id/);
 assert.match(ui,/termWeekId: availability\.termWeekId/);
 assert.match(ui,/\[view, availabilityWeek, center\]/);
});
