import test from "node:test";
import assert from "node:assert/strict";
import {validateDiaryCaptureDraft} from "./tos-diary-capture-validation";

const ready={studentId:"student-1",missionIds:["mission-1"],eligibleIds:["mission-1"],eligibilityLoaded:true,eligibilityHasMore:false,
 notes:"Học viên nhận diện màu tốt.",interest:3,difficulty:""};

test("PAP-945 valid observation with one authorized Mission does not require completion checkbox",()=>{
 assert.deepEqual(validateDiaryCaptureDraft(ready),[]);
});
test("PAP-945 missing Student or Mission blocks form before any write",()=>{
 const x=validateDiaryCaptureDraft({...ready,studentId:"",missionIds:[]});
 assert.ok(x.some(s=>s.includes("học viên")));
 assert.ok(x.some(s=>s.includes("Nhiệm vụ")));
});
test("PAP-945 stale/incomplete Core Mission readback does not pass form",()=>{
 for(const x of [
  {...ready,eligibilityLoaded:false},
  {...ready,eligibilityHasMore:true},
  {...ready,missionIds:["mission-foreign"]},
  {...ready,missionIds:["mission-1","mission-1"]},
 ]){
  assert.ok(validateDiaryCaptureDraft(x).length>0);
 }
});
test("PAP-945 observation is independent of MissionResult and requires notes/interest only",()=>{
 const x=validateDiaryCaptureDraft({...ready,notes:"",interest:null});
 assert.ok(x.some(s=>s.includes("ghi chú")));
 assert.ok(x.some(s=>s.includes("1–4")));
});
test("PAP-945 interest 1 needs difficulty; normal interest does not",()=>{
 assert.ok(validateDiaryCaptureDraft({...ready,interest:1,difficulty:""}).some(x=>x.includes("khó khăn")));
 assert.deepEqual(validateDiaryCaptureDraft({...ready,interest:1,difficulty:"Cần thêm trợ giúp."}),[]);
});
