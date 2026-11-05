import test from "node:test";
import assert from "node:assert/strict";
import {prepareDiarySubmission} from "./tos-diary-submit-preflight";
import {V18bCoreError,type V18bEligibleMissionsRead} from "./tos-classroom-v18b-api";
import type {ClassroomV4ViewModel,ScheduledClass} from "./tos-classroom-v4-view-model";
const day="2026-11-02",center="center-a",run="running-class-a",ctx=run+":"+day,student="student-a",other="student-b";
const classroom:ScheduledClass={id:ctx,runningClassId:run,eligibleStudentIds:[student],name:"Core class",subject:"unknown",path:"—",time:"18:00",room:"",staff:[],expected:[student,other]};
const model:ClassroomV4ViewModel={centerId:center,today:day,staffLabel:"Staff",classes:[classroom],
 data:{students:[{id:student,name:"Student A",age:null,gender:"Khác / chưa cung cấp",domain:"unknown",path:"—"},{id:other,name:"Student B",age:null,gender:"Khác / chưa cung cấp",domain:"unknown",path:"—"}],
 participants:{[ctx]:[student,other]},openings:{},diaries:[],sequence:0},missions:[],diaryReadState:"UNAVAILABLE",missionReadState:"UNAVAILABLE",openingReadState:"UNAVAILABLE",conflictStudentIds:[other]};
const eligibility:V18bEligibleMissionsRead={
 centerId:center,runningClassId:run,studentId:student,localDate:day,teachingContextKey:ctx,pathProgramId:"path-authoritative",
 items:[{missionId:"mission-a",code:"ART-A",name:"Real eligible",level:1,assignmentId:"assignment-a"},
        {missionId:"mission-b",code:"ART-B",name:"Another",level:2,assignmentId:null}],hasMore:false,
};
const input={model,classroom,studentId:student,eligibility,selected:[{missionId:"mission-a",assignmentId:"assignment-a"}],submissionKey:"submission-1"};
const fail=(fn:()=>unknown,code:string)=>assert.throws(fn,(e:unknown)=>e instanceof V18bCoreError&&e.code===code);

test("PAP-945 Diary preflight uses authoritative RunningClass, Path, Center and actual roster; no Mission in Diary Register",()=>{
 const p=prepareDiarySubmission(input);
 assert.deepEqual(p.registration,{centerId:center,runningClassId:run,studentId:student,pathKey:"path-authoritative",teachingContextKey:ctx});
 assert.deepEqual(p.selected,[{missionId:"mission-a",assignmentId:"assignment-a"}]);
 assert.deepEqual(p.eligibleMissionIds,["mission-a","mission-b"]);
 assert.equal(p.submissionKey,"submission-1");
 assert.equal(Object.hasOwn(p.registration,"mission"),false);
 assert.equal(Object.hasOwn(p.registration,"outcomes"),false);
});
test("PAP-945 no valid Mission or missing scoped Core readback always blocks before Register",()=>{
 fail(()=>prepareDiarySubmission({...input,selected:[]}),"DIARY_MISSION_REQUIRED");
 fail(()=>prepareDiarySubmission({...input,eligibility:null}),"DIARY_MISSION_CATALOG_UNAVAILABLE");
 fail(()=>prepareDiarySubmission({...input,eligibility:{...eligibility,items:[]}}),"DIARY_MISSION_NOT_ELIGIBLE");
 fail(()=>prepareDiarySubmission({...input,selected:[{missionId:"mission-foreign"}]}),"DIARY_MISSION_NOT_ELIGIBLE");
 fail(()=>prepareDiarySubmission({...input,selected:[{missionId:"mission-a"},{missionId:"mission-a"}]}),"DIARY_DUPLICATE_MISSION");
});
test("PAP-945 wrong Center/Student/day/teaching context or class identity never prepares a Register",()=>{
 for(const bad of [
  {...input,model:{...model,centerId:"center-foreign"}},
  {...input,model:{...model,today:"2026-11-03"}},
  {...input,classroom:{...classroom,id:"forged-class:2026-11-02"}},
  {...input,classroom:{...classroom,runningClassId:"running-class-foreign"}},
  {...input,eligibility:{...eligibility,centerId:"center-foreign"}},
  {...input,eligibility:{...eligibility,studentId:"student-foreign"}},
  {...input,eligibility:{...eligibility,localDate:"2026-11-03"}},
  {...input,eligibility:{...eligibility,teachingContextKey:"forged"}},
  {...input,eligibility:{...eligibility,runningClassId:"foreign"}},
  {...input,eligibility:{...eligibility,pathProgramId:""}},
 ])fail(()=>prepareDiarySubmission(bad),"DIARY_SCOPE_MISMATCH");
});
test("PAP-945 candidate-only roster and actual student projection; conflict cannot submit",()=>{
 fail(()=>prepareDiarySubmission({...input,studentId:other,eligibility:{...eligibility,studentId:other}}),"DIARY_ROSTER_NOT_ELIGIBLE");
 fail(()=>prepareDiarySubmission({...input,classroom:{...classroom,eligibleStudentIds:[]}}),"DIARY_SCOPE_MISMATCH");
 fail(()=>prepareDiarySubmission({...input,model:{...model,data:{...model.data,students:[]}}}),"DIARY_ROSTER_NOT_ELIGIBLE");
 fail(()=>prepareDiarySubmission({...input,model:{...model,conflictStudentIds:[student]}}),"DIARY_ROSTER_NOT_ELIGIBLE");
});
test("PAP-945 Assignment must exactly come from chosen Core eligibility item",()=>{
 fail(()=>prepareDiarySubmission({...input,selected:[{missionId:"mission-a",assignmentId:"assignment-foreign"}]}),"DIARY_ASSIGNMENT_MISMATCH");
 fail(()=>prepareDiarySubmission({...input,selected:[{missionId:"mission-a"}]}),"DIARY_ASSIGNMENT_MISMATCH");
 fail(()=>prepareDiarySubmission({...input,selected:[{missionId:"mission-b",assignmentId:"unexpected"}]}),"DIARY_ASSIGNMENT_MISMATCH");
 const p=prepareDiarySubmission({...input,selected:[{missionId:"mission-b"}]});
 assert.deepEqual(p.selected,[{missionId:"mission-b"}]);
});
test("PAP-945 blank/missing submission key is never synthesized by preflight",()=>{
 fail(()=>prepareDiarySubmission({...input,submissionKey:""}),"DIARY_SUBMISSION_KEY_INVALID");
 fail(()=>prepareDiarySubmission({...input,submissionKey:" ".repeat(4)}),"DIARY_SUBMISSION_KEY_INVALID");
});
