/** PAP-1497 / SPEC-UNLOCK: exact Core PR2141 candidate wire, not live G4. */
import assert from "node:assert/strict";
import test from "node:test";
import {readTosSpecialtyPickerChoices,type SpecialtyPickerScope} from "./tos-specialty-picker-read";
import {requiresSpecialtySelectionGuard} from "./tos-specialty-mission-availability";
const id=(n:number)=>"01900000-0000-7000-8000-"+String(n).padStart(12,"0");
const scope:SpecialtyPickerScope={centerId:id(1),studentId:id(2),runningClassId:id(3),
 localDate:"2026-11-14",teachingContextKey:id(3)+":2026-11-14",pathProgramId:id(4)};
const item=(n:number,available=true)=>({missionId:id(100+n),code:"ART-"+String(n).padStart(3,"0"),
 name:"Mission "+n,level:1,assignmentId:null,assignmentDefinitionEligible:true,
 assignmentDefinitionBlockReason:null as null|string,available,
 lockReasons:available?[]:[{code:"NO_EFFECTIVE_SPECIALTY_GRANT",relatedId:id(5)}]});
const page=(items:unknown[],hasMore=false,overrides:Record<string,unknown>={})=>
 new Response(JSON.stringify({data:{...scope,items,hasMore,...overrides}}),{status:200});
function reader(pages:Response[]){
 const offsets:string[]=[];
 const transport:typeof fetch=(input,init)=>{
  const url=new URL(String(input),"https://test.invalid");
  assert.equal(url.pathname,"/api/tos-learning/learning/missions/eligible");
  assert.equal(init?.method,"GET");assert.equal(init?.cache,"no-store");
  for(const key of ["centerId","studentId","runningClassId","localDate","teachingContextKey"] as const)
   assert.equal(url.searchParams.get(key),scope[key]);
  offsets.push(url.searchParams.get("offset")??"");
  const next=pages.shift();if(!next)throw new Error("Unexpected page");
  return Promise.resolve(next);
 };
 return {transport,offsets};
}
test("PAP-1497 exact all-page read, available first across page boundaries, no write",async()=>{
 const first=Array.from({length:100},(_,i)=>item(i+1,false));
 const r=reader([page(first,true),page([item(101)])]);
 const list=await readTosSpecialtyPickerChoices(scope,r.transport);
 assert.equal(list.length,101);assert.equal(list[0]?.missionId,id(201));
 assert.equal(list[1]?.available,false);
 assert.deepEqual(r.offsets,["0","100"]);
 assert.equal(requiresSpecialtySelectionGuard(list),true); // legacy writer stays protected
});
test("PAP-1497 wrong Path on page two cannot expose a partial selectable list",async()=>{
 const r=reader([page(Array.from({length:100},(_,i)=>item(i+1)),true),
  page([item(101)],false,{pathProgramId:id(88)})]);
 await assert.rejects(readTosSpecialtyPickerChoices(scope,r.transport),/khớp Path/);
});
test("PAP-1497 reject legacy and incomplete mixed-generation pages",async()=>{
 const {available:unusedAvailable,lockReasons:unusedReasons,...legacy}=item(101);
 void unusedAvailable;void unusedReasons;
 const r=reader([page(Array.from({length:100},(_,i)=>item(i+1)),true),page([legacy])]);
 await assert.rejects(readTosSpecialtyPickerChoices(scope,r.transport),/MISSION_AVAILABILITY_CONTRACT_INVALID/);
});
test("PAP-1497 missing canonical Path prevents any network request",async()=>{
 const r=reader([]);
 await assert.rejects(readTosSpecialtyPickerChoices({...scope,pathProgramId:""},r.transport),/PATH_UNVERIFIED/);
 assert.deepEqual(r.offsets,[]);
});
test("PAP-1497 true definition alone cannot unlock a Specialty; contradiction fails closed",async()=>{
 const r=reader([page([item(1,false)])]);
 assert.equal((await readTosSpecialtyPickerChoices(scope,r.transport))[0]?.available,false);
 const contradiction=reader([page([{...item(2),assignmentDefinitionEligible:false,assignmentDefinitionBlockReason:"MISSION_INELIGIBLE"}])]);
 await assert.rejects(readTosSpecialtyPickerChoices(scope,contradiction.transport),/DEFINITION_CONFLICT/);
});
test("PAP-1497 missing definition evidence and missing prerequisite reason fail closed",async()=>{
 const missing=reader([page([{...item(1),assignmentDefinitionEligible:undefined,assignmentDefinitionBlockReason:undefined}])]);
 await assert.rejects(readTosSpecialtyPickerChoices(scope,missing.transport),/DEFINITION_CONFLICT/);
 const locked={...item(2,false),assignmentDefinitionEligible:false,
  assignmentDefinitionBlockReason:"PREREQUISITE_PROOF_UNAVAILABLE"};
 const absent=reader([page([locked])]);
 await assert.rejects(readTosSpecialtyPickerChoices(scope,absent.transport),/PREREQUISITE_EVIDENCE_MISSING/);
 const complete=reader([page([{...locked,lockReasons:[...locked.lockReasons,{code:"MISSION_PREREQUISITE_INCOMPLETE",relatedId:id(6)}]}])]);
 assert.equal((await readTosSpecialtyPickerChoices(scope,complete.transport))[0]?.lockReasons.length,2);
});
test("PAP-1497 duplicate across pages and denied read reject entire result",async()=>{
 const r=reader([page(Array.from({length:100},(_,i)=>item(i+1)),true),page([item(1)])]);
 await assert.rejects(readTosSpecialtyPickerChoices(scope,r.transport),/trùng/);
 const denied=reader([new Response(JSON.stringify({error:{code:"ACCESS_PERMISSION_DENIED",message:"Denied"}}),{status:403})]);
 await assert.rejects(readTosSpecialtyPickerChoices(scope,denied.transport),/Denied/);
});
