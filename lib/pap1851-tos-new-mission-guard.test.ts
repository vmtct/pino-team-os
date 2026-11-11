import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readTosNewMissionGuard,type TosNewMissionGuardDeps} from "./tos-mission-completion-read";
import {tosMissionAssignmentApi,type TosMissionAssignmentRecord} from "./tos-mission-assignment-api";
import type {V18bClassroomToday} from "./tos-classroom-v18b-api";
const center="01900000-0000-7000-8000-000000000001";
const student="01900000-0000-7000-8000-000000000002";
const running="01900000-0000-7000-8000-000000000003";
const path="01900000-0000-7000-8000-000000000004";
const assignmentId="01900000-0000-7000-8000-000000000005";
const missionId="01900000-0000-7000-8000-000000000006";
const actor="01900000-0000-7000-8000-000000000007";
const date="2026-11-11",teachingContextKey=running+":"+date;
const scope={centerId:center,studentId:student,runningClassId:running,localDate:date,teachingContextKey};
const occurrence:V18bClassroomToday["occurrences"][number]={
 runningClassId:running,teachingContextKey,operationalName:"QA TOS",
 occurrence:{occurrenceKey:"QA",localDate:date,status:"PROJECTED",
  pathProgramId:path,localInterval:null},
 roster:[{studentProfileId:student,studentDisplayName:"Nguyễn An",status:"CANDIDATE",
  planned:true,includedManually:false,inclusionId:null,expectedSources:[]}],
 rosterCoverage:"ENROLLMENTS_AND_GRACE_ONLY",
};
const day:V18bClassroomToday={centerId:center,localDate:date,timeZone:"Asia/Ho_Chi_Minh",
 occurrences:[occurrence],suppressed:[],diagnostics:[]};
const record:TosMissionAssignmentRecord={id:assignmentId,centerId:center,studentId:student,
 missionId,missionCodeSnapshot:"ART-01",missionNameSnapshot:"Pha màu",contextKey:teachingContextKey,
 contextLabel:null,status:"ASSIGNED",assignedAt:"2026-11-11T00:00:00Z",assignedByUserId:actor,
 updatedAt:"2026-11-11T00:00:00Z",updatedByUserId:actor,cancelledAt:null,cancelledReason:null,version:1};
const create=(records:readonly TosMissionAssignmentRecord[],states:Record<string,"IN_PROGRESS"|"COMPLETED">={},
 today:V18bClassroomToday=day)=>{
 const calls:string[]=[];
 const deps:TosNewMissionGuardDeps={
  today:async(c,d)=>{calls.push("day:"+c+":"+d);return today},
  assignments:{...tosMissionAssignmentApi,
   list:async(input)=>{calls.push("list:"+input.centerId+":"+input.status);return [...records]}},
  completion:async(d,o,id,assignment)=>{
   calls.push("completion:"+assignment.id);
   assert.equal(d.centerId,center);assert.equal(o.teachingContextKey,teachingContextKey);
   assert.equal(id,student);
   const status=states[assignment.id]??"IN_PROGRESS";
   return {assignmentId:assignment.id,centerId:center,assignmentStatus:"ASSIGNED",
    executionStatus:status,executionVersion:status==="IN_PROGRESS"?0:1,
    updatedAt:status==="IN_PROGRESS"?null:"2026-11-11T01:00:00Z",
    updatedByUserId:status==="IN_PROGRESS"?null:actor};
  },
 };
 return {calls,deps};
};
test("PAP-1851 source-verified independent IN_PROGRESS blocks only Create and never writes",async()=>{
 const {calls,deps}=create([record]);
 assert.equal(await readTosNewMissionGuard(scope,deps),"UNFINISHED");
 assert.deepEqual(calls,["day:"+center+":"+date,"list:"+center+":ASSIGNED","completion:"+assignmentId]);
});
test("PAP-1851 independently COMPLETED C1 permits eligible choices without confusing ASSIGNED lifecycle",async()=>{
 const {calls,deps}=create([record],{[assignmentId]:"COMPLETED"});
 assert.equal(await readTosNewMissionGuard(scope,deps),"CLEAR");
 assert.equal(calls.length,3);
});
test("PAP-1851 no active Assignment allows create, no unproven C1 read",async()=>{
 const {calls,deps}=create([]);
 assert.equal(await readTosNewMissionGuard(scope,deps),"CLEAR");
 assert.deepEqual(calls,["day:"+center+":"+date,"list:"+center+":ASSIGNED"]);
});
test("PAP-1851 mixed C1 status with one open blocks new choices",async()=>{
 const another={...record,id:"01900000-0000-7000-8000-000000000008",
  missionId:"01900000-0000-7000-8000-000000000009"};
 const {deps,calls}=create([record,another],{[record.id]:"COMPLETED"});
 assert.equal(await readTosNewMissionGuard(scope,deps),"UNFINISHED");
 assert.equal(calls.filter(x=>x.startsWith("completion:")).length,2);
});
test("PAP-1851 C1 failure and cross-Center/CONFLICT roster always fail closed",async()=>{
 const p=create([record]);p.deps.completion=async()=>{throw Error("CORE_403")};
 await assert.rejects(readTosNewMissionGuard(scope,p.deps),/CORE_403/);
 const bad=create([record],{}, {...day,centerId:student});
 await assert.rejects(readTosNewMissionGuard(scope,bad.deps));
 assert.equal(bad.calls.some(x=>x.startsWith("list:")),false);
 const conflict=create([record],{}, {...day,occurrences:[{...occurrence,
  roster:[{...occurrence.roster[0]!,status:"CONFLICT"}]}]});
 await assert.rejects(readTosNewMissionGuard(scope,conflict.deps));
 assert.equal(conflict.calls.some(x=>x.startsWith("list:")),false);
});
test("PAP-1851 aborted student selection cannot authorize stale Mission choice",async()=>{
 const p=create([record]);
 const c=new AbortController();c.abort();
 await assert.rejects(readTosNewMissionGuard(scope,p.deps,c.signal));
 assert.equal(p.calls.length,0);
});
test("PAP-1851 UI waits for C1 before choices and hides all new options on verified open",()=>{
 const s=readFileSync("app/components/tos-vnext/MissionAssignmentTab.tsx","utf8");
 const pos=s.indexOf("readTosNewMissionGuard("),choice=s.indexOf("getTosMissionCommandChoices(",pos);
 assert.ok(pos>0&&choice>pos);
 assert.match(s,/if\(state==="UNFINISHED"\)\{setCreateGate\("unfinished"\);return;\}/);
 assert.match(s,/!!editor\.old\|\|createGate==="clear"/);
 assert.match(s,/Còn nhiệm vụ chưa hoàn thành/);
 assert.match(s,/!editor\.old&&createGate!=="clear"/);
 assert.match(s,/editor\.old\?"clear":"loading"/);
 assert.match(s,/if\(editor\.old\)setChoices/);
 assert.doesNotMatch(s.slice(pos,choice),/getTosMissionCommandChoices\(/);
});
