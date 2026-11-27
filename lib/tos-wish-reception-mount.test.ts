import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
test("Wish mount shares selected learner, is Center keyed and preserves recent learner host",()=>{
 const s=readFileSync("app/components/tos-vnext/ReceptionHouseCheckIn.tsx","utf8");
 assert.match(s,/selected && <TosWishRuntime centerId=\{centerId\} learnerId=\{selected.studentProfileId\} legalName=\{selected.displayName\} gender=\{null\}/);
 assert.match(s,/placeholder="Tìm Học Viên"/);assert.match(s,/loadRecentLearners/);assert.match(s,/tosReceptionHouseApi.checkIn/);
 const host=readFileSync("app/components/tos-vnext/TosVNextReception.tsx","utf8");assert.match(host,/<ReceptionHouseCheckIn key=\{centerId\} centerId=\{centerId\} loadRecentLearners=\{tosReceptionHouseApi.recent\} onVisitChanged=\{refresh\}/);
 const wish=readFileSync("app/components/tos-vnext/TosWishRuntime.tsx","utf8");assert.match(wish,/window.location.hostname==="tos.staging.pinohouse.art"/);assert.match(wish,/p.centerId\+":"\+p.learnerId/);
});
