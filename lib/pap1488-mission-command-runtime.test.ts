import test from "node:test";
import assert from "node:assert/strict";
import {
  createTosMissionAssignmentVerified,getTosMissionCommandChoices,
  replaceTosMissionAssignmentVerified,type MissionCommandDeps,
} from "./tos-mission-assignment-command-runtime";
import type {TosMissionAssignmentRecord,TosMissionAssignmentScope} from "./tos-mission-assignment-api";
const center="01900000-0000-7000-8000-000000000001";
const student="01900000-0000-7000-8000-000000000002";
const running="01900000-0000-7000-8000-000000000003";
const path="01900000-0000-7000-8000-000000000004";
const mission="01900000-0000-7000-8000-000000000005";
const next="01900000-0000-7000-8000-000000000006";
const actor="01900000-0000-7000-8000-000000000007";
const recordId="01900000-0000-7000-8000-000000000008";
const nextId="01900000-0000-7000-8000-000000000009";
const date="2026-11-17";
const scope:TosMissionAssignmentScope={
  centerId:center,studentId:student,runningClassId:running,
  localDate:date,teachingContextKey:running+":"+date,
};
const original:TosMissionAssignmentRecord={
  id:recordId,centerId:center,studentId:student,missionId:mission,
  missionCodeSnapshot:"ART-1",missionNameSnapshot:"Sáng tạo",contextKey:scope.teachingContextKey,
  contextLabel:null,status:"ASSIGNED",assignedAt:"2026-11-17T00:00:00.000Z",
  assignedByUserId:actor,updatedAt:"2026-11-17T00:00:00.000Z",updatedByUserId:actor,
  cancelledAt:null,cancelledReason:null,version:1,
};
const choice=(id:string,assignmentId:string|null=null)=>({
  missionId:id,code:"ART-1",name:"Sáng tạo",level:1,assignmentId,
  assignmentDefinitionEligible:true,assignmentDefinitionBlockReason:null as null,
});
function setup(initial:TosMissionAssignmentRecord[]=[],withCandidate=true){
  const records=[...initial];const calls:string[]=[];
  const mock:MissionCommandDeps={
    today:async (c,d)=>{
      calls.push("today");assert.equal(c,center);assert.equal(d,date);
      return {centerId:center,localDate:date,occurrences:[{
        runningClassId:running,teachingContextKey:scope.teachingContextKey,
        occurrence:{localDate:date,status:"PROJECTED",pathProgramId:path},
        roster:withCandidate?[{studentProfileId:student,status:"CANDIDATE"}]:[],
      }]};
    },
    eligible:async _scope=>{calls.push("eligible");return [choice(mission),choice(next)]},
    assignments:{
      list:async s=>{calls.push("list");assert.equal(s.centerId,center);
        return records.filter(x=>x.status===s.status)},
      get:async (_s,id)=>{calls.push("get");return records.find(x=>x.id===id)!},
      create:async (input,key)=>{
        calls.push("create:"+key);
        const created={...original,
          id:input.missionId===mission?recordId:nextId,missionId:input.missionId,
          version:1,status:"ASSIGNED" as const};
        records.push(created);return created;
      },
      updateContext:async()=>{throw Error("No context edit in this surface")},
      cancel:async (_s,id,input,key)=>{
        calls.push("cancel:"+key);const index=records.findIndex(r=>r.id===id);
        const cancelled={...records[index]!,status:"CANCELLED" as const,
          version:input.expectedVersion+1,cancelledAt:"2026-11-17T01:00:00.000Z",
          cancelledReason:input.reason};
        records[index]=cancelled;return cancelled;
      },
    },
  };
  return {mock,calls,records};
}

test("PAP-1488: fresh candidate and eligible definition admit one create, read back exact Assignment",async()=>{
 const {mock,calls,records}=setup();
 const out=await createTosMissionAssignmentVerified(scope,mission,"pap1488-create-key-0000001",mock);
 assert.equal(out.id,recordId);assert.equal(records.length,1);
 assert.equal(calls.filter(c=>c.startsWith("create:")).length,1);
 assert.equal(calls.filter(c=>c==="list").length,2);
 assert.equal(calls.filter(c=>c==="today").length,1);
 assert.doesNotMatch(calls.join(" "),/diary|result|session/i);
});

test("PAP-1488: no CANDIDATE or foreign Center fails before POST",async()=>{
 const {mock,calls}=setup([],false);
 await assert.rejects(createTosMissionAssignmentVerified(scope,mission,"pap1488-key-valid",mock));
 await assert.rejects(getTosMissionCommandChoices({...scope,centerId:student},mock));
 assert.equal(calls.some(c=>c.startsWith("create:")),false);
});

test("PAP-1488: incomplete eligibility or duplicate active Mission never writes",async()=>{
 const {mock,calls}=setup([original]);
 await assert.rejects(createTosMissionAssignmentVerified(scope,mission,"pap1488-key-valid",mock));
 assert.equal(calls.some(c=>c.startsWith("create:")),false);
 mock.eligible=async()=>[{...choice(next),assignmentDefinitionEligible:undefined}];
 await assert.rejects(createTosMissionAssignmentVerified(scope,next,"pap1488-key-valid",mock));
 assert.equal(calls.some(c=>c.startsWith("create:")),false);
});

test("PAP-1488: replacement cancels old then creates new with two keys, verifies both records",async()=>{
 const {mock,calls,records}=setup([original]);
 const result=await replaceTosMissionAssignmentVerified(scope,recordId,1,next,
    "Đổi sang Mission phù hợp","pap1488-cancel-0001","pap1488-create-0002",mock);
 assert.equal(result.state,"verified");
 assert.deepEqual(calls.filter(c=>c.startsWith("cancel:")||c.startsWith("create:")),
    ["cancel:pap1488-cancel-0001","create:pap1488-create-0002"]);
 assert.equal(records[0]?.status,"CANCELLED");
 assert.equal(records[1]?.status,"ASSIGNED");
 assert.equal(records[1]?.missionId,next);
});

test("PAP-1488: stale version cannot CANCEL; partial replacement is PENDING_CREATE, no automatic retry",async()=>{
 const {mock,calls}=setup([original]);
 await assert.rejects(replaceTosMissionAssignmentVerified(scope,recordId,5,next,
   "Đổi sang Mission phù hợp","pap1488-cancel-0001","pap1488-create-0002",mock));
 assert.equal(calls.some(c=>c.startsWith("cancel:")),false);
 const oldCreate=mock.assignments.create;let attempts=0;
 mock.assignments.create=async (...args)=>{attempts++;throw Error("ambiguous network response")};
 const pending=await replaceTosMissionAssignmentVerified(scope,recordId,1,next,
   "Đổi sang Mission phù hợp","pap1488-cancel-0001","pap1488-create-0002",mock);
 assert.equal(pending.state,"PENDING_CREATE");
 assert.equal(attempts,1);
 assert.equal(calls.filter(x=>x.startsWith("cancel:")).length,1);
 mock.assignments.create=oldCreate;
});

test("PAP-1488: after successful POST, missing independent readback never claims VERIFIED",async()=>{
 const {mock}=setup();
 mock.assignments.list=async()=>[];
 await assert.rejects(createTosMissionAssignmentVerified(scope,mission,"pap1488-key-valid",mock));
});
