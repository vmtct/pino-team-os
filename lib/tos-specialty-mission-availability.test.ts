import assert from "node:assert/strict";
import test from "node:test";
import {
  validateTosScopedMissionChoices,filterTosScopedMissions,describeTosMissionLocks,
  type TosScopedMissionChoice,
} from "./tos-specialty-mission-availability";

const available:TosScopedMissionChoice={
  missionId:"m1",code:"ART-01",name:"Vẽ hình 3D",level:2,assignmentId:null,
  available:true,lockReasons:[],
};
const locked:TosScopedMissionChoice={
  missionId:"m2",code:"ART-02",name:"Màu sắc nâng cao",level:3,assignmentId:null,
  available:false,lockReasons:[
    {code:"NO_EFFECTIVE_SPECIALTY_GRANT",relatedId:"specialty-anime"},
    {code:"MISSION_PREREQUISITE_INCOMPLETE",relatedId:"m0"},
  ],
};
test("PAP-1497: authoritative availability must exist — legacy rows fail closed",()=>{
  assert.throws(()=>validateTosScopedMissionChoices([{missionId:"m1",code:"ART-01",name:"Vẽ",level:1,assignmentId:null}]),/MISSION_AVAILABILITY_CONTRACT_INVALID/);
  assert.throws(()=>validateTosScopedMissionChoices(null),/MISSING_SCOPED_MISSIONS/);
});
test("PAP-1497: cannot claim available when any lock reason exists",()=>{
  assert.throws(()=>validateTosScopedMissionChoices([{...locked,available:true}]),/MISSION_AVAILABILITY_CONFLICT/);
  assert.throws(()=>validateTosScopedMissionChoices([{...available,available:false}]),/MISSION_AVAILABILITY_CONFLICT/);
});
test("PAP-1497: unknown lock code or duplicate Mission fails closed",()=>{
  assert.throws(()=>validateTosScopedMissionChoices([{...locked,lockReasons:[{code:"UNKNOWN"}]}]),/LOCK_REASON_INVALID/);
  assert.throws(()=>validateTosScopedMissionChoices([available,available]),/DUPLICATE_MISSION_ID/);
});
test("PAP-1497: retains all missions and sorts available before locked",()=>{
  const list=validateTosScopedMissionChoices([locked,available]);
  assert.deepEqual(filterTosScopedMissions(list).map(x=>x.missionId),["m1","m2"]);
  assert.deepEqual(filterTosScopedMissions(list,"available").map(x=>x.missionId),["m1"]);
  assert.deepEqual(filterTosScopedMissions(list,"locked").map(x=>x.missionId),["m2"]);
});
test("PAP-1497: accent and code search applies within selected filter",()=>{
  const list=[available,locked];
  assert.deepEqual(filterTosScopedMissions(list,"all","vE").map(x=>x.missionId),["m1"]);
  assert.deepEqual(filterTosScopedMissions(list,"locked","mau").map(x=>x.missionId),["m2"]);
  assert.deepEqual(filterTosScopedMissions(list,"available","ART-02"),[]);
});
test("PAP-1497: displays actual multiple lock reasons, never reports a grant",()=>{
  assert.deepEqual(describeTosMissionLocks(locked),[
    "Chuyên đề chưa được mở khóa · specialty-anime",
    "Chưa hoàn thành nhiệm vụ tiên quyết · m0",
  ]);
  assert.deepEqual(describeTosMissionLocks(available),[]);
});
test("PAP-1497: does not mutate the Core response",()=>{
  const raw=[locked,available];
  const copy=filterTosScopedMissions(raw);
  copy.pop();
  assert.deepEqual(raw.map(x=>x.missionId),["m2","m1"]);
});
