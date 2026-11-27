import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
test("Wish mount shares selected learner, is Center keyed and preserves recent learner host",()=>{
 const s=readFileSync("app/components/tos-vnext/ReceptionHouseCheckIn.tsx","utf8");
 assert.match(s,/selected && wishVisit && <TosWishRuntime key=\{wishVisit.id\} centerId=\{centerId\} learnerId=\{selected.studentProfileId\} legalName=\{selected.displayName\} gender=\{null\}/);
 assert.match(s,/activeVisitIds\?\.\[selected.studentProfileId\]===selected.openVisit.id/);assert.match(s,/\[centerId, query, refresh, loadRecentLearners, visitRevision\]/);
 assert.match(s,/placeholder="Tìm Học Viên"/);assert.match(s,/loadRecentLearners/);assert.match(s,/tosReceptionHouseApi.checkIn/);
 const host=readFileSync("app/components/tos-vnext/TosVNextReception.tsx","utf8");assert.match(host,/<ReceptionHouseCheckIn key=\{centerId\} centerId=\{centerId\} loadRecentLearners=\{tosReceptionHouseApi.recent\} onVisitChanged=\{refresh\}/);
 assert.match(host,/visitRevision=\{revision\} activeVisitIds=\{Object.fromEntries\(Object.values\(day\?\.activeVisits\?\?\{\}\).filter\(v=>v.checkedOutAt===null\)/);
 const wish=readFileSync("app/components/tos-vnext/TosWishRuntime.tsx","utf8");assert.match(wish,/window.location.hostname==="tos.staging.pinohouse.art"/);assert.match(wish,/p.centerId\+":"\+p.learnerId/);
});

test("PAP-2431 Pinoria reuses exact staging Wish host and only live open Visit candidates",()=>{
 const host=readFileSync("app/components/tos-vnext/TosVNextReception.tsx","utf8");
 const view=readFileSync("app/components/tos-vnext/ReceptionV4Presentation.tsx","utf8");
 assert.match(host,/filter\(v=>v\.checkedOutAt===null\)/);
 assert.match(host,/renderWish=\{\(guest,visitId\)=><TosWishRuntime key=\{visitId\}/);
 assert.match(view,/wishCandidateMap\.get\(wishSelection\.learnerId\)===wishSelection\.visitId/);
 assert.match(view,/disabled=\{!wishEnabled\|\|!renderWish\}/);
});
