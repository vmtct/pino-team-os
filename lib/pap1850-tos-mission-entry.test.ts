import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const source=(f:string)=>readFileSync(join(process.cwd(),"app/components/tos-vnext",f),"utf8");

test("PAP-1850 Student-tab CTA uses one authorized Mission Assignment editor",()=>{
 const s=source("ClassroomV4Presentation.tsx");
 const m=source("MissionAssignmentTab.tsx");
 assert.match(s,/aria-label=\{"Thêm nhiệm vụ cho "\+s.name\}/);
 assert.match(s,/disabled=\{readOnly\}/);
 assert.match(s,/setMissionCreateRequest\(\{id:missionCreateSequence.current,studentId:s.id\}\)/);
 assert.match(s,/visible=\{tab==="missions"\} createRequest=\{missionCreateRequest\}/);
 assert.match(m,/consumedCreateRequest\.current===createRequest\.id/);
 assert.match(m,/groups\.some\(g=>g.studentId===createRequest.studentId\)/);
 assert.match(m,/open\(createRequest\.studentId\)/);
 assert.match(m,/onCreateRequestConsumed\?\.\(createRequest.id\)/);
 assert.match(m,/hidden=\{!visible\}/);
 assert.match(m,/!visible&&createRequest&&read.state==="UNAVAILABLE"/);
 assert.match(m,/editor&&<AppModalRoot/);
});
test("PAP-1850 Mission Add controls show one plus; error retry is contextual only",()=>{
 const s=source("MissionAssignmentTab.tsx"),css=source("classroom.module.css");
 assert.equal((s.match(/<FontAwesomeIcon icon=\{faPlus\}\/> Thêm/g)||[]).length,2);
 assert.doesNotMatch(s,/faPlus\}\/> \+ Thêm/);
 assert.doesNotMatch(s,/read.state==="UNAVAILABLE"\|\|attempt>0/);
 assert.match(s,/read.state==="UNAVAILABLE"&&<button/);
 assert.match(s,/Tải lại nhiệm vụ/);
 assert.match(css,/\.missionReadRetry/);
 assert.match(css,/\.missionReadError/);
 assert.match(css,/\.missionReadRetry:focus-visible/);
});
