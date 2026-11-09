import test from "node:test";
import assert from "node:assert/strict";
import {readTosMissionCompletion} from "./tos-mission-completion-read";
import type {AssignmentV18bToday, AssignmentV18bOccurrence} from "./tos-mission-assignment-workflow";
import type {TosMissionAssignmentRecord} from "./tos-mission-assignment-api";

const center="01900000-0000-7000-8000-000000000001";
const student="01900000-0000-7000-8000-000000000002";
const running="01900000-0000-7000-8000-000000000003";
const path="01900000-0000-7000-8000-000000000004";
const assignmentId="01900000-0000-7000-8000-000000000005";
const missionId="01900000-0000-7000-8000-000000000006";
const actor="01900000-0000-7000-8000-000000000007";
const date="2026-11-09";
const teachingContextKey=running+":"+date;
const occurrence:AssignmentV18bOccurrence={
  runningClassId:running,teachingContextKey,occurrence:{
    localDate:date,status:"PROJECTED",pathProgramId:path,
  },roster:[{studentProfileId:student,status:"CANDIDATE"}],
};
const day:AssignmentV18bToday={centerId:center,localDate:date,occurrences:[occurrence]};
const record:TosMissionAssignmentRecord={
  id:assignmentId,centerId:center,studentId:student,missionId,
  missionCodeSnapshot:"P1",missionNameSnapshot:"Vẽ nét",contextKey:teachingContextKey,
  contextLabel:null,status:"ASSIGNED",assignedAt:"2026-11-09T00:00:00.000Z",
  assignedByUserId:actor,updatedAt:"2026-11-09T00:00:00.000Z",
  updatedByUserId:actor,cancelledAt:null,cancelledReason:null,version:1,
};
const initial={
  assignmentId,centerId:center,assignmentStatus:"ASSIGNED",
  executionStatus:"IN_PROGRESS",executionVersion:0,updatedAt:null,updatedByUserId:null,
};
const completed={
  ...initial,executionStatus:"COMPLETED",executionVersion:1,
  updatedAt:"2026-11-09T01:00:00.000Z",updatedByUserId:actor,
};
const reply=(data:unknown,status=200)=>Response.json({data},{status});
const statusError=(error:unknown,status:number)=>{
  assert.ok(error&&typeof error==="object"&&"status" in error);
  assert.equal((error as {status:number}).status,status);
  return true;
};

test("PAP-1488: read exact Core TOS completion GET for authenticated candidate scope only",async()=>{
  const calls:Array<{url:string;method:string;body?:BodyInit|null}>=[];
  const fetcher:typeof fetch=async(url,init)=>{
    calls.push({url:String(url),method:init?.method??"GET",body:init?.body});
    return reply(initial);
  };
  const result=await readTosMissionCompletion(day,occurrence,student,record,fetcher);
  assert.deepEqual(result,initial);
  assert.equal(calls.length,1);
  assert.equal(calls[0]?.method,"GET");
  assert.equal(calls[0]?.body,undefined);
  assert.equal(calls[0]?.url,"/api/tos-learning/learning/mission-assignments/"+
    assignmentId+"/completion?"+new URLSearchParams({
      centerId:center,studentId:student,runningClassId:running,
      localDate:date,teachingContextKey,
    }));
});

test("PAP-1488: independent COMPLETED projection never becomes Assignment lifecycle status",async()=>{
  const fetcher:typeof fetch=async()=>reply(completed);
  const result=await readTosMissionCompletion(day,occurrence,student,record,fetcher);
  assert.equal(result.assignmentStatus,"ASSIGNED");
  assert.equal(result.executionStatus,"COMPLETED");
  assert.equal(result.executionVersion,1);
});

test("PAP-1488: invalid roster, occurrence or Assignment ID never calls Core",async()=>{
  let calls=0;
  const fetcher:typeof fetch=async()=>{calls++;return reply(initial)};
  const bad=[
    [day,{...occurrence,roster:[{studentProfileId:student,status:"CONFLICT"}]},record],
    [day,occurrence,{...record,id:"not-a-uuid"}],
    [day,occurrence,{...record,centerId:student}],
    [day,occurrence,{...record,studentId:center}],
    [day,occurrence,{...record,contextKey:"bad"}],
    [day,occurrence,{...record,status:"CANCELLED"}],
  ] as const;
  for(const [today,slot,assignment] of bad){
    await assert.rejects(readTosMissionCompletion(today,slot,student,
      assignment as TosMissionAssignmentRecord,fetcher));
  }
  assert.equal(calls,0);
});

test("PAP-1488: forged state, wrong Center, wrong assignment, fabricated actor or version fail closed",async()=>{
  const invalid=[
    {...completed,assignmentId:missionId},
    {...completed,centerId:student},
    {...completed,executionStatus:"ASSIGNED"},
    {...completed,executionVersion:0},
    {...completed,updatedByUserId:"not-a-uuid"},
    {...completed,updatedAt:"invalid"},
    {...initial,updatedByUserId:actor},
    {...initial,updatedAt:"2026-11-09T01:00:00.000Z"},
    {...initial,assignmentStatus:"CANCELLED"},
  ];
  for(const response of invalid){
    const fetcher:typeof fetch=async()=>reply(response);
    await assert.rejects(readTosMissionCompletion(day,occurrence,student,record,fetcher),
      error=>statusError(error,502));
  }
});

test("PAP-1488: 401/403/404, invalid JSON and unavailable Core never synthesize EMPTY or COMPLETE",async()=>{
  for(const status of [401,403,404,503]){
    const fetcher:typeof fetch=async()=>reply(null,status);
    await assert.rejects(readTosMissionCompletion(day,occurrence,student,record,fetcher),
      error=>statusError(error,status));
  }
  const badJson:typeof fetch=async()=>new Response("{not-json",{status:200});
  await assert.rejects(readTosMissionCompletion(day,occurrence,student,record,badJson),
    error=>statusError(error,502));
  const aborted=new AbortController();aborted.abort();
  let calls=0;
  const fetcher:typeof fetch=async()=>{calls++;return reply(initial)};
  await assert.rejects(readTosMissionCompletion(day,occurrence,student,record,fetcher,aborted.signal));
  assert.equal(calls,0);
});
