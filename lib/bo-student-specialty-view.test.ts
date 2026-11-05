import assert from "node:assert/strict";
import test from "node:test";
import {
  validateBoStudentSpecialtyList,boStudentSpecialtyStatus,boStudentSpecialtyStatusText,
} from "./bo-student-specialty-view";

const incomplete={
  specialty:{id:"specialty-anime",name:"Anime Sơn Vực",pathProgramId:"art"},
  grant:{id:"grant-a",startDate:"2026-11-05",version:1},grantEffective:true,
  progress:{completedDistinctMissionCount:2,totalDistinctMissionCount:3,
    completionStatus:"NOT_COMPLETED",missingMissionIds:["m3"]},
  canGrant:false,grantBlockReasons:[],
};
const unlocked={...incomplete,
  progress:{...incomplete.progress,completedDistinctMissionCount:3,
    missingMissionIds:[],completionStatus:"COMPLETED"},
};
const locked={...incomplete,grant:null,grantEffective:false,
  progress:{...incomplete.progress,completedDistinctMissionCount:0,missingMissionIds:["m1","m2","m3"]},
  canGrant:false,grantBlockReasons:["Chưa hoàn thành Chuyên Đề trước"],
};
test("PAP-1496: BO Student progress 2/3 != completed; 3/3 completed",()=>{
  const rows=validateBoStudentSpecialtyList([incomplete,unlocked].map((row,i)=>({
    ...row,specialty:{...row.specialty,id:"spec-"+i},
  })));
  assert.equal(boStudentSpecialtyStatus(rows[0]!),"UNLOCKED");
  assert.equal(boStudentSpecialtyStatus(rows[1]!),"COMPLETED");
  assert.equal(boStudentSpecialtyStatusText("COMPLETED"),"Hoàn thành");
});
test("PAP-1496: locked never treated as granted; blocked reasons remain visible",()=>{
  const item=validateBoStudentSpecialtyList([locked])[0]!;
  assert.equal(boStudentSpecialtyStatus(item),"LOCKED");
  assert.deepEqual(item.grantBlockReasons,["Chưa hoàn thành Chuyên Đề trước"]);
});
test("PAP-1496: future grant separate from Mission completion",()=>{
  const future={...unlocked,grantEffective:false};
  const row=validateBoStudentSpecialtyList([future])[0]!;
  assert.equal(boStudentSpecialtyStatus(row),"PENDING_EFFECTIVE_DATE");
});
test("PAP-1496: rejects missing Core truth instead of creating fake status",()=>{
  assert.throws(()=>validateBoStudentSpecialtyList(null),/STUDENT_SPECIALTIES_NOT_LOADED/);
  assert.throws(()=>validateBoStudentSpecialtyList([{...incomplete,progress:undefined}]),/STUDENT_SPECIALTY_CONTRACT_INVALID/);
  assert.throws(()=>validateBoStudentSpecialtyList([{...incomplete,grantEffective:undefined}]),/STUDENT_SPECIALTY_CONTRACT_INVALID/);
});
test("PAP-1496: rejects contradictory progress, duplicate Mission child count",()=>{
  assert.throws(()=>validateBoStudentSpecialtyList([{...incomplete,
    progress:{...incomplete.progress,completedDistinctMissionCount:3}}]),/STUDENT_SPECIALTY_PROGRESS_CONFLICT/);
  assert.throws(()=>validateBoStudentSpecialtyList([{...incomplete,
    progress:{...incomplete.progress,missingMissionIds:["m3","m3"]}}]),/STUDENT_SPECIALTY_PROGRESS_CONFLICT/);
  assert.throws(()=>validateBoStudentSpecialtyList([{...incomplete,
    progress:{completedDistinctMissionCount:0,totalDistinctMissionCount:0,
      completionStatus:"COMPLETED",missingMissionIds:[]}}]),/STUDENT_SPECIALTY_PROGRESS_CONFLICT/);
});
test("PAP-1496: cannot offer grant twice or mark effective without grant",()=>{
  assert.throws(()=>validateBoStudentSpecialtyList([{...incomplete,canGrant:true}]),/STUDENT_SPECIALTY_GRANT_CONFLICT/);
  assert.throws(()=>validateBoStudentSpecialtyList([{...locked,grantEffective:true}]),/STUDENT_SPECIALTY_GRANT_CONFLICT/);
  assert.throws(()=>validateBoStudentSpecialtyList([incomplete,incomplete]),/DUPLICATE_SPECIALTY/);
});
test("PAP-1496: no source mutation and no implicit commercial units",()=>{
  const before=JSON.stringify(incomplete);
  const rows=validateBoStudentSpecialtyList([incomplete]);
  assert.equal(JSON.stringify(incomplete),before);
  assert.equal(Object.hasOwn(rows[0]!,"unitCount"),false);
});
