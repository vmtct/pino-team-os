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
 assert.match(source,/Core chưa có read-model Center-wide/);
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
 assert.match(home,/founderMode\|\|app\.id!=="shift-lead"/);
 assert.match(home,/Founder · Giám sát TOS/);
 assert.match(integration,/<TosVNextHome founderMode profileLabel="Founder"/);
});
