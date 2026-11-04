import test from "node:test";
import assert from "node:assert/strict";
import {classroomV4ReadModel} from "./tos-classroom-v4-view-model";
import {isConfirmedSkipDiaryEntry} from "./tos-diary-skip-opening";
import type {V18bClassroomToday} from "./tos-classroom-v18b-api";
const context="class-1:2026-11-03";
function model(status:"CANDIDATE"|"CONFLICT"="CANDIDATE"){
 const day:V18bClassroomToday={
  centerId:"center-1",localDate:"2026-11-03",timeZone:"Asia/Ho_Chi_Minh",
  suppressed:[],diagnostics:[],occurrences:[{
   teachingContextKey:context,runningClassId:"class-1",operationalName:"QA Art",
   occurrence:{occurrenceKey:context,pathProgramId:"path-1",localDate:"2026-11-03",
    status:"SCHEDULED",localInterval:null},
   roster:[{studentProfileId:"student-1",studentDisplayName:"Synthetic QA",
    status,planned:true,includedManually:false,inclusionId:null,expectedSources:[]}],
   rosterCoverage:"ENROLLMENTS_AND_GRACE_ONLY",
  }],
 };
 return classroomV4ReadModel(day,"QA Staff");
}
test("PAP-727 actual eligible Core classroom requires explicit per-class Skip confirmation",()=>{
 const m=model(),room=m.classes[0]!;
 assert.equal(isConfirmedSkipDiaryEntry(m,room,""),false);
 assert.equal(isConfirmedSkipDiaryEntry(m,room,"another-class:2026-11-03"),false);
 assert.equal(isConfirmedSkipDiaryEntry(m,room,context),true);
 assert.equal(m.openingReadState,"UNAVAILABLE","skip must not claim an opening");
 assert.deepEqual(m.data.openings,{},"skip must not manufacture a photo");
});
test("PAP-727 skip never admits missing, conflicting or mismatched roster",()=>{
 const m=model(),room=m.classes[0]!;
 assert.equal(isConfirmedSkipDiaryEntry(model("CONFLICT"),model("CONFLICT").classes[0]!,context),false);
 assert.equal(isConfirmedSkipDiaryEntry({...m,classes:[]},room,context),false);
 assert.equal(isConfirmedSkipDiaryEntry({...m,today:"2026-11-04"},room,context),false);
 assert.equal(isConfirmedSkipDiaryEntry({...m,data:{...m.data,participants:{}}},room,context),false);
 assert.equal(isConfirmedSkipDiaryEntry({...m,conflictStudentIds:["student-1"]},room,context),false);
 assert.equal(isConfirmedSkipDiaryEntry(m,{...room,runningClassId:"class-other"},context),false);
});
