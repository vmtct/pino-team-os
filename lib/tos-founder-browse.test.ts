import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("PAP-938 Founder browse never impersonates a StaffMember or fabricates shift evidence",()=>{
 const source=readFileSync("app/prototype/tos-vnext-integration/TosVNextIntegrationClient.tsx","utf8");
 const effectStart=source.indexOf("if(ctx.founderMode){");
 const shiftRead=source.indexOf("void shiftReadModel(",effectStart);
 assert.ok(effectStart>0&&shiftRead>effectStart,"Founder skips all self-scoped schedule reads");
 assert.match(source,/if\(ctx\?\.founderMode\)\{/);
 assert.match(source,/const canBrowse=\(id:TosVNextAppId\)=>id!=="station"\|\|desktop/);
 assert.match(source,/"shift-lead":"Trưởng Ca"/);
 assert.match(source,/Chế độ Founder/);
 assert.match(source,/workforceApi\.founderCenterSchedule/);
 assert.match(source,/Phân công thực từ Core/);
 assert.match(source,/Chưa có read-model Center-wide/);
 assert.doesNotMatch(source.slice(effectStart,shiftRead),/workforceApi\.schedule\(|checkIn\(|checkOut\(/);
});

test("PAP-938 staging Staff/Founder login routes to authoritative TOS V4",()=>{
 const login=readFileSync("app/staff-login/page.tsx","utf8");
 assert.match(login,/hostname === "tos.staging.pinohouse.art"\) return "\/tos-v4"/);
 assert.match(login,/body\.data\?\.authenticated/);
});

test("PAP-938 Founder Home exposes even Shift Leader as read-only browser panel",()=>{
 const home=readFileSync("app/components/tos-vnext/TosVNextHome.tsx","utf8");
 const integration=readFileSync("app/prototype/tos-vnext-integration/TosVNextIntegrationClient.tsx","utf8");
 // PAP-1127: all six tiles are now available to authenticated/Center-scoped actors;
 // Founder still only receives Core-authorized read-only projections in this surface.
 assert.match(home,/const enabled=!busy&&allowed\(app\.id\)/);
 assert.doesNotMatch(home,/founderMode\|\|app\.id!=="shift-lead"/);
 assert.match(home,/Founder · Giám sát TOS/);
 assert.match(integration,/<TosVNextHome founderMode profileLabel="Founder"/);
});

test("PAP-1059 S2 Founder Center visits use Core read projection, not Staff check-in",()=>{
 const source=readFileSync("app/prototype/tos-vnext-integration/TosVNextIntegrationClient.tsx","utf8");
 const api=readFileSync("lib/workforce-api.ts","utf8");
 assert.match(source,/workforceApi\.founderCenterVisits\(\{centerId,status:"ALL"\}\)/);
 assert.match(source,/Student Visits · Dữ liệu thực từ Core/);
 assert.match(source,/data\.visits\.summary\.openVisits/);
 assert.match(source,/Promise\.allSettled/);
 assert.match(source,/data\.founderError/);
 assert.match(source,/data\.visitsError/);
 assert.match(api,/founderCenterVisits:/);
 assert.doesNotMatch(source.slice(source.indexOf("if(ctx?.founderMode){"),source.indexOf("if(!appRenderable)")),/workforceApi\.checkIn\(|workforceApi\.checkOut\(/);
});

test("PAP-1059 S3 Founder operations panels read only Center data through Core",()=>{
 const ui=readFileSync("app/prototype/tos-vnext-integration/TosVNextIntegrationClient.tsx","utf8");
 const api=readFileSync("lib/workforce-api.ts","utf8");
 for(const name of ["Timekeeping","Duty","Training","Station"]){
  assert.match(ui,new RegExp("workforceApi\\.founderCenter"+name+"\\("));
  assert.match(api,new RegExp("founderCenter"+name+":"));
 }
 for(const state of ["timekeepingError","dutyError","trainingError","stationError"]){assert.match(ui,new RegExp("data\\."+state));}
 assert.match(ui,/Promise\.allSettled/);
 assert.doesNotMatch(ui.slice(ui.indexOf("if(ctx?.founderMode){"),ui.indexOf("if(!appRenderable)")),/workforceApi\.checkIn\(|workforceApi\.checkOut\(/);
});