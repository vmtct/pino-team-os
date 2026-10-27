import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("PAP-938 Founder browse never impersonates a StaffMember or fabricates shift evidence",()=>{
 const source=readFileSync("app/prototype/tos-vnext-integration/TosVNextIntegrationClient.tsx","utf8");
 const effectStart=source.indexOf("if(ctx.founderMode){setError");
 const shiftRead=source.indexOf("void shiftReadModel(",effectStart);
 assert.ok(effectStart>0&&shiftRead>effectStart,"Founder skips all self-scoped schedule reads");
 assert.match(source,/if\(ctx\?\.founderMode\)\{/);
 assert.match(source,/const canBrowse=\(id:TosVNextAppId\)=>id!=="station"\|\|desktop/);
 assert.match(source,/"shift-lead":"Trưởng Ca"/);
 assert.match(source,/Chế độ Founder/);
 assert.match(source,/thao tác Staff cá nhân vẫn yêu cầu tài khoản Staff hợp lệ/);
 assert.doesNotMatch(source.slice(effectStart,shiftRead),/workforceApi\.schedule\(|checkIn\(|checkOut\(/);
});

test("PAP-938 staging Staff/Founder login routes to authoritative TOS V4",()=>{
 const login=readFileSync("app/staff-login/page.tsx","utf8");
 assert.match(login,/hostname === "tos.staging.pinohouse.art"\) return "\/tos-v4"/);
 assert.match(login,/body\.data\?\.authenticated/);
});
