import test from "node:test";
import assert from "node:assert/strict";
import {classroomV4ReadModel} from "./tos-classroom-v4-view-model";
import type {V18bClassroomToday} from "./tos-classroom-v18b-api";

const center="01900000-0000-7000-8000-000000000001";
const runningClass="01900000-0000-7000-8000-000000000002";
const good="01900000-0000-7000-8000-000000000003";
const conflict="01900000-0000-7000-8000-000000000004";
const date="2026-11-02";
const contextKey=runningClass+":"+date;
const member=(id:string,status:"CANDIDATE"|"CONFLICT")=>({
 studentProfileId:id,studentDisplayName:"Synthetic "+id.slice(-2),status,
 planned:true,includedManually:false,inclusionId:null,expectedSources:[],
});
const day:V18bClassroomToday={
 centerId:center,localDate:date,timeZone:"Asia/Ho_Chi_Minh",
 occurrences:[{
  runningClassId:runningClass,teachingContextKey:contextKey,operationalName:"QA Class",
  occurrence:{occurrenceKey:contextKey,pathProgramId:"01900000-0000-7000-8000-000000000005",localDate:date,status:"READY",localInterval:null},
  roster:[member(good,"CANDIDATE"),member(conflict,"CONFLICT")],
  rosterCoverage:"ENROLLMENTS_AND_GRACE_ONLY",
 }],suppressed:[],diagnostics:[],
};

test("PAP-945 VNext source projection preserves Center and exact RunningClass scope",()=>{
 const m=classroomV4ReadModel(day,"Staff");
 assert.equal(m.centerId,center);
 assert.equal(m.today,date);
 assert.equal(m.classes.length,1);
 assert.equal(m.classes[0]?.runningClassId,runningClass);
 assert.equal(m.classes[0]?.id,contextKey);
 assert.deepEqual(m.classes[0]?.eligibleStudentIds,[good]);
 assert.deepEqual(m.classes[0]?.expected,[good,conflict]);
 assert.deepEqual(m.conflictStudentIds,[conflict]);
 assert.equal(m.missionReadState,"UNAVAILABLE");
 assert.deepEqual(m.missions,[]);
});

test("PAP-945 empty actual roster does not invent eligible students or missions",()=>{
 const empty=classroomV4ReadModel({...day,occurrences:day.occurrences.map(c=>({...c,roster:[]}))},"Staff");
 assert.deepEqual(empty.classes[0]?.eligibleStudentIds,[]);
 assert.deepEqual(empty.classes[0]?.expected,[]);
 assert.deepEqual(empty.missions,[]);
});
