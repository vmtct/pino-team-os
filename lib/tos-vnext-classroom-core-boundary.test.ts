import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classroomV4ReadModel} from "./tos-classroom-v4-view-model";
import {loadClassroomV4} from "./tos-classroom-v4-reader";
import type {V18bClassroomToday} from "./tos-classroom-v18b-api";
const day:V18bClassroomToday={centerId:"center-1",localDate:"2026-10-26",timeZone:"Asia/Ho_Chi_Minh",occurrences:[{teachingContextKey:"opaque-occurrence",runningClassId:"class-1",operationalName:"Lớp từ Core",occurrence:{occurrenceKey:"occ-1",pathProgramId:"path-1",localDate:"2026-10-26",status:"EXPECTED",localInterval:null},roster:[{studentProfileId:"student-1",studentDisplayName:"Tên từ Core",status:"CONFLICT",planned:true,includedManually:false,inclusionId:null,expectedSources:[]}],rosterCoverage:"ENROLLMENTS_AND_GRACE_ONLY"}],suppressed:[],diagnostics:[]};
test("PAP-945 maps only real Core facts; missing domain, age, room, staff and Diary stay unknown",()=>{
 const model=classroomV4ReadModel(day,"Tên nhân sự");assert.equal(model.classes[0].id,"opaque-occurrence");assert.equal(model.data.students[0].name,"Tên từ Core");assert.equal(model.data.students[0].age,null);assert.equal(model.data.students[0].domain,"unknown");assert.equal(model.classes[0].room,"");assert.deepEqual(model.classes[0].staff,[]);assert.deepEqual(model.conflictStudentIds,["student-1"]);
 assert.equal(model.diaryReadState,"UNAVAILABLE");assert.equal(model.missionReadState,"UNAVAILABLE");assert.equal(model.openingReadState,"UNAVAILABLE");assert.deepEqual(model.data.openings,{});
});
test("PAP-945 rejects cross-center/date response before exposing a view model",async()=>{
 const original=globalThis.fetch;
 try{for(const altered of [{...day,centerId:"foreign"},{...day,localDate:"2026-10-27"}]){
  globalThis.fetch=async()=>Response.json({data:altered});await assert.rejects(loadClassroomV4("center-1","2026-10-26","Actor"),/không khớp/);
 }}finally{globalThis.fetch=original}
});
test("PAP-945 protected renderer has no datastore, fixture import or business transport",()=>{
 const source=readFileSync("app/components/tos-vnext/ClassroomV4Presentation.tsx","utf8");assert.doesNotMatch(source,/localStorage|sessionStorage|recordClassBypass|readData|persist\(|fetch\(|test-fixtures|seededDiaries/);
 const driver=readFileSync("app/components/tos-vnext/TosVNextClassroom.tsx","utf8");assert.match(driver,/read\.key!==key\|\|read\.busy/);
});
