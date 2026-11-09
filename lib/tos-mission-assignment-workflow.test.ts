import test from "node:test";
import assert from "node:assert/strict";
import type { TosMissionAssignmentRecord, TosMissionAssignmentScope } from "./tos-mission-assignment-api";
import { TosMissionAssignmentApiError } from "./tos-mission-assignment-api";
import { assignmentScopeForCandidate, cancelMissionAssignment, createMissionAssignment,
 editMissionAssignmentContext, loadAssignmentsInOccurrence, replaceMissionAssignment,
 resumeMissionReplacement, type AssignmentV18bToday } from "./tos-mission-assignment-workflow";

const ids={center:"11111111-1111-4111-8111-111111111111",
student:"22222222-2222-4222-8222-222222222222",
runningClass:"33333333-3333-4333-8333-333333333333",
mission:"44444444-4444-4444-8444-444444444444",
otherMission:"66666666-6666-4666-8666-666666666666",
assignment:"55555555-5555-4555-8555-555555555555",
replacement:"77777777-7777-4777-8777-777777777777"};
const scope:TosMissionAssignmentScope={centerId:ids.center,studentId:ids.student,
 runningClassId:ids.runningClass,localDate:"2026-11-05",
 teachingContextKey:ids.runningClass+":2026-11-05"};
const today:AssignmentV18bToday={centerId:scope.centerId,localDate:scope.localDate,occurrences:[{
 runningClassId:scope.runningClassId,teachingContextKey:scope.teachingContextKey,
 occurrence:{localDate:scope.localDate,status:"PROJECTED",pathProgramId:ids.mission},
 roster:[{studentProfileId:ids.student,status:"CANDIDATE"}]}]};
function record(partial:Partial<TosMissionAssignmentRecord>={}):TosMissionAssignmentRecord{
 return {id:ids.assignment,centerId:ids.center,studentId:ids.student,
  missionId:ids.mission,missionCodeSnapshot:"ART-101",missionNameSnapshot:"Nét đầu tiên",
  contextKey:scope.teachingContextKey,contextLabel:null,status:"ASSIGNED",
  assignedAt:"2026-11-05T10:00:00Z",assignedByUserId:ids.student,
  updatedAt:"2026-11-05T10:00:00Z",updatedByUserId:ids.student,
  cancelledAt:null,cancelledReason:null,version:1,...partial};
}
function cancelled(){return record({status:"CANCELLED",cancelledReason:"Thay đổi",
 cancelledAt:"2026-11-05T11:00:00Z",version:2});}
const denied=(code:string,status=403)=>new TosMissionAssignmentApiError(status,code,code);
const fail=(task:()=>unknown,code:string)=>assert.throws(task,(e:unknown)=>
 e instanceof TosMissionAssignmentApiError&&e.code===code);
// PAP-1488 reader-only tests: unexpected writes must always fail explicitly.
const noWrites={
 create:async():Promise<never>=>{throw Error("Unexpected Assignment CREATE in reader test")},
 updateContext:async():Promise<never>=>{throw Error("Unexpected Assignment EDIT in reader test")},
 cancel:async():Promise<never>=>{throw Error("Unexpected Assignment CANCEL in reader test")},
};

test("only an authentic projected V18b occurrence with CANDIDATE enters Assignment",()=>{
 assert.deepEqual(assignmentScopeForCandidate(today,today.occurrences[0]!,ids.student),scope);
 fail(()=>assignmentScopeForCandidate(today,{...today.occurrences[0]!,teachingContextKey:"wrong"},ids.student),
  "MISSION_ASSIGNMENT_ROSTER_SCOPE_DENIED");
 fail(()=>assignmentScopeForCandidate(today,today.occurrences[0]!,ids.replacement),
  "MISSION_ASSIGNMENT_ROSTER_SCOPE_DENIED");
 const invalid=structuredClone(today);invalid.occurrences[0]!.roster[0]!.status="CONFLICT";
 fail(()=>assignmentScopeForCandidate(invalid,invalid.occurrences[0]!,ids.student),
  "MISSION_ASSIGNMENT_ROSTER_SCOPE_DENIED");
 invalid.occurrences[0]!.occurrence.status="SUPPRESSED";
 fail(()=>assignmentScopeForCandidate(invalid,invalid.occurrences[0]!,ids.student),
  "MISSION_ASSIGNMENT_ROSTER_SCOPE_DENIED");
});

test("read filters exact class/date; same student in other occurrence is not today's Assignment",async()=>{
 let calls=0;
 const api={list:async(input:unknown)=>{calls++;assert.deepEqual(input,{...scope,status:"ASSIGNED",limit:100,offset:0});
  return [record(),record({id:ids.replacement,contextKey:ids.runningClass+":2026-11-04"})];},
  create:async()=>{throw Error("unexpected")},updateContext:async()=>{throw Error("unexpected")},
  cancel:async()=>{throw Error("unexpected")}};
 const rows=await loadAssignmentsInOccurrence(api,scope);
 assert.equal(rows.length,1);assert.equal(rows[0]!.id,ids.assignment);assert.equal(calls,1);
});

test("PAP-1488 reader rejects cross-center and duplicate IDs",async()=>{
 const api=(rows:TosMissionAssignmentRecord[])=>({list:async()=>rows,
  create:async()=>{throw Error("unreachable")},
  updateContext:async()=>{throw Error("unreachable")},
  cancel:async()=>{throw Error("unreachable")}});
 for(const [rows,code] of [
  [[record({centerId:ids.replacement})],"MISSION_ASSIGNMENT_SOURCE_MISMATCH"],
  [[record({studentId:ids.replacement})],"MISSION_ASSIGNMENT_SOURCE_MISMATCH"],
  [[record(),record()],"MISSION_ASSIGNMENT_DUPLICATE_ID"],
 ] as const){
  await assert.rejects(loadAssignmentsInOccurrence(api([...rows]),scope),
   (e:unknown)=>e instanceof TosMissionAssignmentApiError&&e.code===code);
 }
});

test("PAP-1488 reader collects all pages before filtering dated occurrence; exact 100 is complete",async()=>{
 const pageOf=(offset:number,count:number,contextKey=scope.teachingContextKey)=>
  Array.from({length:count},(_,i)=>record({
   id:String(offset+i).padStart(8,"0")+"-5555-4555-8555-555555555555",contextKey}));
 for(const tail of [[],pageOf(100,1)]){
  const offsets:number[]=[];
  const first=pageOf(0,100,ids.runningClass+":2026-11-04");
  const api={...noWrites,list:async(input:{offset?:number;limit?:number})=>{
   assert.equal(input.limit,100);offsets.push(input.offset??-1);
   return input.offset===0?first:tail;
  }};
  const rows=await loadAssignmentsInOccurrence(api,scope);
  assert.equal(rows.length,tail.length);
  assert.deepEqual(rows.map(x=>x.id),tail.map(x=>x.id));
  assert.deepEqual(offsets,[0,100]);
 }
});

test("PAP-1488 reader rejects duplicate IDs and changed Center/Student on later pages",async()=>{
 const first=Array.from({length:100},(_,i)=>record({
  id:String(i).padStart(8,"0")+"-5555-4555-8555-555555555555"}));
 const cases=[
  {page:[first[0]!],code:"MISSION_ASSIGNMENT_DUPLICATE_ID"},
  {page:[record({id:ids.replacement,centerId:ids.replacement})],code:"MISSION_ASSIGNMENT_SOURCE_MISMATCH"},
  {page:[record({id:ids.replacement,studentId:ids.replacement})],code:"MISSION_ASSIGNMENT_SOURCE_MISMATCH"},
  {page:first,code:"MISSION_ASSIGNMENT_DUPLICATE_ID"},
 ] as const;
 for(const variant of cases){
  const offsets:number[]=[];
  const api={...noWrites,list:async(input:{offset?:number})=>{
   offsets.push(input.offset??-1);
   return input.offset===0?first:[...variant.page];
  }};
  await assert.rejects(loadAssignmentsInOccurrence(api,scope),
   (e:unknown)=>e instanceof TosMissionAssignmentApiError&&e.code===variant.code);
  assert.deepEqual(offsets,[0,100]);
 }
});

test("PAP-1488 reader fails closed on later fetch error, overfull page and exhausted offset bound",async()=>{
 const first=Array.from({length:100},(_,i)=>record({
  id:String(i).padStart(8,"0")+"-5555-4555-8555-555555555555"}));
 const failure=new TosMissionAssignmentApiError(503,"SECOND_PAGE_DOWN","retry");
 let calls=0;
 await assert.rejects(loadAssignmentsInOccurrence({...noWrites,list:async(input:{offset?:number})=>{
  calls++;if(input.offset===0)return first;throw failure;
 }},scope),(e:unknown)=>e===failure);
 assert.equal(calls,2);
 await assert.rejects(loadAssignmentsInOccurrence({...noWrites,list:async()=>[...first,record()]},scope),
  (e:unknown)=>e instanceof TosMissionAssignmentApiError&&e.code==="MISSION_ASSIGNMENT_PAGE_INCOMPLETE");
 const offsets:number[]=[];
 await assert.rejects(loadAssignmentsInOccurrence({...noWrites,list:async(input:{offset?:number})=>{
  const offset=input.offset??-1;offsets.push(offset);
  return Array.from({length:100},(_,i)=>record({
   id:String(offset+i).padStart(8,"0")+"-5555-4555-8555-555555555555"}));
 }},scope),(e:unknown)=>e instanceof TosMissionAssignmentApiError&&e.code==="MISSION_ASSIGNMENT_PAGE_INCOMPLETE");
 assert.equal(offsets.length,101);
 assert.equal(offsets[0],0);assert.equal(offsets.at(-1),10000);
});

test("create only Core Assignment; rejects mismatched persisted Center",async()=>{
 let writes=0;
 const api={list:async()=>[],create:async(input:unknown,key:string)=>{
  writes++;assert.deepEqual(input,{...scope,missionId:ids.mission,contextLabel:"Vẽ nét"});
  assert.equal(key,"assign-once");return record();},
  updateContext:async()=>{throw Error("unexpected Diary writer")},
  cancel:async()=>{throw Error("unexpected Diary writer")}};
 const assigned=await createMissionAssignment(api,scope,ids.mission,"assign-once","Vẽ nét");
 assert.equal(assigned.id,ids.assignment);assert.equal(writes,1);
 await assert.rejects(createMissionAssignment({...api,create:async()=>record({centerId:ids.replacement})},
  scope,ids.mission,"assign-once"),(e:unknown)=>
  e instanceof TosMissionAssignmentApiError&&e.code==="MISSION_ASSIGNMENT_SOURCE_MISMATCH");
});

test("Edit context preserves ID and increments CAS expectedVersion",async()=>{
 const api={list:async()=>[],create:async()=>record(),cancel:async()=>cancelled(),
  updateContext:async(s:unknown,id:string,change:unknown,key:string)=>{
   assert.deepEqual(s,scope);assert.equal(id,ids.assignment);
   assert.deepEqual(change,{expectedVersion:1,contextLabel:"Mục tiêu mới"});assert.equal(key,"edit-once");
   return record({version:2,contextLabel:"Mục tiêu mới"});}};
 const changed=await editMissionAssignmentContext(api,scope,record(),"Mục tiêu mới","edit-once");
 assert.equal(changed.version,2);
});

test("Cancel forwards version, audit reason and verifies terminal receipt",async()=>{
 const api={list:async()=>[],create:async()=>record(),updateContext:async()=>record(),
  cancel:async(_s:unknown,id:string,change:unknown,key:string)=>{
   assert.equal(id,ids.assignment);assert.equal(key,"cancel-once");
   assert.deepEqual(change,{expectedVersion:1,reason:"Thay đổi"});return cancelled();}};
 const cancelledRow=await cancelMissionAssignment(api,scope,record(),"Thay đổi","cancel-once");
 assert.equal(cancelledRow.status,"CANCELLED");
 await assert.rejects(cancelMissionAssignment(api,scope,record({status:"CANCELLED"}),
  "Thay đổi","other"),(e:unknown)=>e instanceof TosMissionAssignmentApiError);
});

test("Đổi performs verified cancel-old then create-new; never updates immutable missionId",async()=>{
 const commands:string[]=[];
 const api={list:async()=>[],updateContext:async()=>{throw Error("no immutable updates")},
  cancel:async(_s:unknown,id:string,change:unknown,key:string)=>{
   commands.push("cancel");assert.equal(id,ids.assignment);assert.equal(key,"old-cancel");
   assert.deepEqual(change,{expectedVersion:1,reason:"Đổi nhiệm vụ"});return cancelled();},
  create:async(input:unknown,key:string)=>{
   commands.push("create");assert.equal(key,"new-create");
   assert.deepEqual(input,{...scope,missionId:ids.otherMission,contextLabel:undefined});
   return record({id:ids.replacement,missionId:ids.otherMission});}};
 const value=await replaceMissionAssignment(api,scope,record(),ids.otherMission,
  "Đổi nhiệm vụ","old-cancel","new-create");
 assert.equal(value.state,"REPLACED");assert.deepEqual(commands,["cancel","create"]);
 if(value.state==="REPLACED"){assert.equal(value.cancelled.status,"CANCELLED");
  assert.equal(value.created.missionId,ids.otherMission);}
});

test("cancel conflict prevents create; no hidden retry",async()=>{
 let cancelCalls=0,createCalls=0;
 const api={list:async()=>[],updateContext:async()=>record(),
  cancel:async()=>{cancelCalls++;throw denied("VERSION_CONFLICT",409)},
  create:async()=>{createCalls++;return record()}};
 await assert.rejects(replaceMissionAssignment(api,scope,record(),ids.otherMission,
  "Đổi nhiệm vụ","old-cancel","new-create"),(e:unknown)=>
  e instanceof TosMissionAssignmentApiError&&e.status===409);
 assert.equal(cancelCalls,1);assert.equal(createCalls,0);
});

test("after confirmed cancel, failed create yields PENDING_CREATE; manual resume uses SAME key only",async()=>{
 let cancelCalls=0,createCalls=0;
 const api={list:async()=>[],updateContext:async()=>record(),
  cancel:async()=>{cancelCalls++;return cancelled()},
  create:async(_input:unknown,key:string)=>{
   createCalls++;assert.equal(key,"replay-key-1");
   if(createCalls===1)throw denied("NETWORK_UNCERTAIN",503);
   return record({id:ids.replacement,missionId:ids.otherMission});}};
 const value=await replaceMissionAssignment(api,scope,record(),ids.otherMission,
  "Đổi nhiệm vụ","cancel-once","replay-key-1");
 assert.equal(value.state,"PENDING_CREATE");
 if(value.state==="PENDING_CREATE"){
  assert.equal(value.cancelled.status,"CANCELLED");
  const resumed=await resumeMissionReplacement(api,scope,value);
  assert.equal(resumed.state,"REPLACED");
 }
 assert.equal(cancelCalls,1);assert.equal(createCalls,2);
});

test("same mission and shared idempotency key forbidden before any mutation",async()=>{
 let writes=0;const api={list:async()=>[],updateContext:async()=>record(),
 create:async()=>{writes++;return record()},cancel:async()=>{writes++;return cancelled()}};
 await assert.rejects(replaceMissionAssignment(api,scope,record(),ids.mission,
  "Đổi nhiệm vụ","old","new"),(e:unknown)=>e instanceof TosMissionAssignmentApiError&&e.status===400);
 await assert.rejects(replaceMissionAssignment(api,scope,record(),ids.otherMission,
  "Đổi nhiệm vụ","same","same"),(e:unknown)=>e instanceof TosMissionAssignmentApiError&&e.status===400);
 assert.equal(writes,0);
});
