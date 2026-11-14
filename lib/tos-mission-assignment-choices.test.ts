import test from "node:test";
import assert from "node:assert/strict";
import { TosMissionAssignmentApiError, type TosMissionAssignmentScope } from "./tos-mission-assignment-api";
import { assignmentDefinitionReadyChoices, readTosEligibleMissions } from "./tos-mission-assignment-choices";

const scope:TosMissionAssignmentScope={
 centerId:"11111111-1111-4111-8111-111111111111",
 studentId:"22222222-2222-4222-8222-222222222222",
 runningClassId:"33333333-3333-4333-8333-333333333333",
 localDate:"2026-11-05",
 teachingContextKey:"33333333-3333-4333-8333-333333333333:2026-11-05",
};
const mission=(id="44444444-4444-4444-8444-444444444444",assignmentId:string|null=null)=>({
 missionId:id,code:"ART-101",name:"Nét đầu tiên",level:1,assignmentId,
});
const page=(items:unknown[],more=false,patch:Record<string,unknown>={})=>({
 data:{...scope,pathProgramId:"55555555-5555-4555-8555-555555555555",
  items,hasMore:more,...patch},
});
const err=(code:string,status?:number)=>(e:unknown)=>
 e instanceof TosMissionAssignmentApiError&&e.code===code&&(!status||e.status===status);

test("reads only scoped Staff eligible API and preserves Core assignmentId",async()=>{
 let calls=0;
 const transport=async(input:unknown,init?:RequestInit)=>{
  calls++;const url=new URL(String(input),"https://team.invalid");
  assert.equal(url.pathname,"/api/tos-learning/learning/missions/eligible");
  for(const [key,value] of Object.entries(scope))assert.equal(url.searchParams.get(key),value);
  assert.equal(url.searchParams.get("limit"),"100");
  assert.equal(url.searchParams.get("offset"),"0");
  assert.equal(init?.method,"GET");assert.equal(init?.cache,"no-store");
  return Response.json(page([mission("44444444-4444-4444-8444-444444444444",
   "66666666-6666-4666-8666-666666666666"),mission("77777777-7777-4777-8777-777777777777")]));
 };
 const rows=await readTosEligibleMissions(scope,transport as typeof fetch);
 assert.equal(rows.length,2);assert.equal(rows[0]?.assignmentId,"66666666-6666-4666-8666-666666666666");
 assert.equal(calls,1);
});

test("reject forged Center, Student or context in successful response",async()=>{
 for(const mutation of [{centerId:"88888888-8888-4888-8888-888888888888"},
   {studentId:"99999999-9999-4999-8999-999999999999"},
   {teachingContextKey:"bad"}]){
  await assert.rejects(readTosEligibleMissions(scope,async()=>Response.json(page([mission()],false,mutation))),
   err("TOS_ELIGIBLE_MISSION_SCOPE_MISMATCH",502));
 }
});

test("fail closed on repeated Mission IDs, malformed items or incomplete batch",async()=>{
 for(const itemset of [
   [mission(),mission()],
   [mission("not-a-uuid")],
   [mission("44444444-4444-4444-8444-444444444444","invalid-assignment")],
  ]){
   await assert.rejects(readTosEligibleMissions(scope,async()=>Response.json(page(itemset))),
    err("TOS_ELIGIBLE_MISSION_INVALID_ITEM",502));
 }
 await assert.rejects(readTosEligibleMissions(scope,async()=>Response.json(page([mission()],true))),
  err("TOS_ELIGIBLE_MISSION_SCOPE_MISMATCH",502));
});

test("403 from Core is exposed without retries, not converted to fake options",async()=>{
 let calls=0;
 await assert.rejects(readTosEligibleMissions(scope,async()=>{
  calls++;return Response.json({error:{code:"ACCESS_PERMISSION_DENIED"}},{status:403});
 }),err("ACCESS_PERMISSION_DENIED",403));
 assert.equal(calls,1);
});

test("scope validated before any transport call",async()=>{
 let calls=0;
 await assert.rejects(readTosEligibleMissions({...scope,localDate:"2026-02-30"},async()=>{
  calls++;return Response.json(page([]));
 }),err("TOS_ELIGIBLE_MISSION_SCOPE_INVALID",400));
 assert.equal(calls,0);
});

test("bounded two-page reader emits all records without duplicating results",async()=>{
 let calls=0;
 const first=Array.from({length:100},(_,i)=>mission(
  String(i).padStart(8,"0")+"-4444-4444-8444-444444444444"));
 const last=mission("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
 const t=async(input:unknown)=>{
  calls++;const url=new URL(String(input),"https://team.invalid");
  const offset=url.searchParams.get("offset");
  assert.equal(offset,calls===1?"0":"100");
  return Response.json(page(calls===1?first:[last],calls===1));
 };
 const rows=await readTosEligibleMissions(scope,t as typeof fetch);
 assert.equal(rows.length,101);assert.equal(calls,2);
});

test("PAP-1529 respects 13-item shared Diary catalog but selects only source-ready definitions",async()=>{
 const approved={...mission(),assignmentDefinitionEligible:true,assignmentDefinitionBlockReason:null};
 const prerequisite={...mission("77777777-7777-4777-8777-777777777777"),
  assignmentDefinitionEligible:false,assignmentDefinitionBlockReason:"PREREQUISITE_PROOF_UNAVAILABLE"};
 const unresolvedPath={...mission("88888888-8888-4888-8888-888888888888"),
  assignmentDefinitionEligible:false,assignmentDefinitionBlockReason:"MISSION_INELIGIBLE"};
 const raw=await readTosEligibleMissions(scope,
  (async()=>Response.json(page([approved,prerequisite,unresolvedPath]))) as typeof fetch);
 assert.equal(raw.length,3); // original Diary choice list is never filtered
 const ready=assignmentDefinitionReadyChoices(raw);
 assert.deepEqual(ready,[raw[0]]);
 assert.equal(raw[1]?.assignmentDefinitionBlockReason,"PREREQUISITE_PROOF_UNAVAILABLE");
 assert.equal(raw[2]?.assignmentDefinitionBlockReason,"MISSION_INELIGIBLE");
});

test("PAP-1529 missing, contradictory or invented Core readiness fails closed for Assignment",()=>{
 const valid={...mission(),assignmentDefinitionEligible:true,assignmentDefinitionBlockReason:null};
 const invalid=[
  mission(), // older Core: no create-admissibility proof
  {...valid,assignmentDefinitionEligible:true,assignmentDefinitionBlockReason:"MISSION_INELIGIBLE"},
  {...valid,assignmentDefinitionEligible:false,assignmentDefinitionBlockReason:null},
  {...valid,assignmentDefinitionEligible:false,assignmentDefinitionBlockReason:"UNSUPPORTED"},
  {...valid,assignmentDefinitionEligible:"true",assignmentDefinitionBlockReason:null},
 ];
 for(const item of invalid){
  assert.throws(()=>assignmentDefinitionReadyChoices([valid,item]),
   err("TOS_ASSIGNMENT_DEFINITION_READINESS_UNVERIFIED",502));
 }
 assert.deepEqual(assignmentDefinitionReadyChoices([]),[]);
});

test("PAP-1933 rejects an eligible page from a different class Path", async () => {
 const expectedPath = "55555555-5555-4555-8555-555555555555";
 const wrongPath = "66666666-6666-4666-8666-666666666666";
 const first = Array.from({length:100}, (_, index) => mission(
  String(index).padStart(8, "0") + "-4444-4444-8444-444444444444"));
 let calls = 0;
 const transport = async () => {
  calls++;
  return calls === 1
   ? Response.json(page(first, true))
   : Response.json(page([mission()], false, {pathProgramId:wrongPath}));
 };
 await assert.rejects(readTosEligibleMissions({...scope,pathProgramId:expectedPath}, transport),
  err("TOS_ELIGIBLE_MISSION_PATH_MISMATCH", 502));
 assert.equal(calls, 2);
});
