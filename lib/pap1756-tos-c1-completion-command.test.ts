/** PAP-1756 / Epic PAP-1676 MISSION-ASSIGNMENT — C1 command adapter TDD. */
import test from "node:test";
import assert from "node:assert/strict";
import {submitVerifiedC1Completion} from "./tos-mission-completion-command";
import type {AssignmentV18bOccurrence,AssignmentV18bToday} from "./tos-mission-assignment-workflow";
import type {TosMissionAssignmentRecord} from "./tos-mission-assignment-api";
import type {ObservationOutcome} from "./tos-diary-observation-workflow";

const center="01900000-0000-7000-8000-000000000001";
const student="01900000-0000-7000-8000-000000000002";
const running="01900000-0000-7000-8000-000000000003";
const pathId="01900000-0000-7000-8000-000000000004";
const assignmentId="01900000-0000-7000-8000-000000000005";
const missionId="01900000-0000-7000-8000-000000000006";
const actor="01900000-0000-7000-8000-000000000007";
const diaryId="01900000-0000-7000-8000-000000000008";
const date="2026-11-09",context=running+":"+date;
const day:AssignmentV18bToday={centerId:center,localDate:date,occurrences:[]};
const occurrence:AssignmentV18bOccurrence={runningClassId:running,teachingContextKey:context,
  occurrence:{status:"PROJECTED",localDate:date,pathProgramId:pathId},
  roster:[{studentProfileId:student,status:"CANDIDATE"}]};
day.occurrences=[occurrence];
const assignment:TosMissionAssignmentRecord={
  id:assignmentId,centerId:center,studentId:student,missionId,
  missionCodeSnapshot:"QA-01",missionNameSnapshot:"QA art",contextKey:context,
  contextLabel:null,status:"ASSIGNED",version:1,
  assignedAt:"2026-11-09T00:00:00.000Z",assignedByUserId:actor,
  updatedAt:"2026-11-09T00:00:00.000Z",updatedByUserId:actor,
  cancelledAt:null,cancelledReason:null};
const proof:ObservationOutcome={state:"LINK_VERIFIED",
  plan:{diaryId,centerId:center,submissionKey:"qa-diary-submission-001",
    selected:[{missionId,assignmentId}]},
  verifiedMissionIds:[missionId],pendingMissionIds:[]};
const pending={assignmentId,centerId:center,assignmentStatus:"ASSIGNED",
  executionStatus:"IN_PROGRESS",executionVersion:0,updatedAt:null,updatedByUserId:null};
const completed={...pending,executionStatus:"COMPLETED",executionVersion:1,
  updatedAt:"2026-11-09T10:00:00.000Z",updatedByUserId:actor};
const key="pap1756-qa-complete-20261109-once";
const base={day,occurrence,studentId:student,assignment,diaryReceipt:proof,
  checked:true,writeAdmitted:true,idempotencyKey:key};

test("PAP-1756 unchecked checkbox is NOOP, never GET or POST",async()=>{
 let calls=0;
 const result=await submitVerifiedC1Completion({...base,checked:false},async()=>{calls++;return Response.json({data:pending})});
 assert.equal(result.state,"NOOP_UNCHECKED");
 assert.equal(calls,0);
});

test("PAP-1756 missing, pending, mismatched, or unlinked Diary receipt fails before network",async()=>{
 let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;return Response.json({data:pending})};
 const cases=[null,{...proof,state:"LINK_PENDING"},{...proof,verifiedMissionIds:[]},
   {...proof,plan:{...proof.plan,diaryId:"invalid-diary-id"}},
   {...proof,plan:{...proof.plan,selected:[{missionId,assignmentId:student}]}},
   {...proof,plan:{...proof.plan,selected:[{missionId}]}},
   {...proof,plan:{...proof.plan,centerId:student}},
  ] as unknown as (ObservationOutcome|null)[];
 for(const diaryReceipt of cases)
   await assert.rejects(submitVerifiedC1Completion({...base,diaryReceipt},fetcher));
 assert.equal(calls,0);
});

test("PAP-1756 unadmitted write, wrong Assignment, stale roster fail closed before network",async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;return Response.json({data:pending})};
 await assert.rejects(submitVerifiedC1Completion({...base,writeAdmitted:false},fetcher));
 await assert.rejects(submitVerifiedC1Completion({...base,assignment:{...assignment,studentId:center}},fetcher));
 await assert.rejects(submitVerifiedC1Completion({...base,occurrence:{...occurrence,roster:[]}},fetcher));
 await assert.rejects(submitVerifiedC1Completion({...base,idempotencyKey:"x"},fetcher));
 assert.equal(calls,0);
});

test("PAP-1756 reads execution, POSTs one exact C1 command, then GET verifies Core",async()=>{
 const calls:Array<{url:string;method:string;headers?:HeadersInit;body?:unknown}>=[];
 const transport:typeof fetch=async(url,init)=>{
  const method=init?.method??"GET";
  calls.push({url:String(url),method,headers:init?.headers,
    body:init?.body?JSON.parse(String(init.body)):undefined});
  return Response.json({data:calls.length===1?pending:completed},
    {status:200});
 };
 const result=await submitVerifiedC1Completion(base,transport);
 assert.equal(result.state,"VERIFIED");
 if(result.state!=="VERIFIED")return;
 assert.deepEqual(result.execution,completed);
 assert.equal(calls.length,3);
 assert.deepEqual(calls.map(c=>c.method),["GET","POST","GET"]);
 assert.equal(calls[1]?.url,"/api/tos-learning/learning/mission-assignments/"+assignmentId+"/completion");
 assert.deepEqual(calls[1]?.body,{centerId:center,studentId:student,
  runningClassId:running,localDate:date,teachingContextKey:context,
  completed:true,expectedVersion:0});
 assert.equal((calls[1]?.headers as Record<string,string>)["idempotency-key"],key);
 assert.ok(calls[2]?.url.includes("teachingContextKey="));
});

test("PAP-1756 unknown POST acknowledgement does not retry or claim COMPLETED",async()=>{
 const calls:string[]=[];
 const transport:typeof fetch=async(url,init)=>{
  calls.push(init?.method??"GET");
  if(calls.length===2)throw new Error("lost ACK after Core commit");
  return Response.json({data:pending});
 };
 const result=await submitVerifiedC1Completion(base,transport);
 assert.equal(result.state,"UNVERIFIED");
 assert.deepEqual(calls,["GET","POST"]);
 if(result.state==="UNVERIFIED")assert.equal(result.idempotencyKey,key);
});

test("PAP-1756 Core 409 and 403 are not translated into UI success or auto retry",async()=>{
 for(const status of [403,409]){
  const calls:string[]=[];
  const transport:typeof fetch=async(_url,init)=>{
   calls.push(init?.method??"GET");
   return Response.json(calls.length===1?{data:pending}:{error:{code:"DENIED",message:"blocked"}},{status:calls.length===1?200:status});
  };
  await assert.rejects(submitVerifiedC1Completion(base,transport));
  assert.deepEqual(calls,["GET","POST"]);
 }
});

test("PAP-1756 Core already COMPLETED or forged post-read mismatch never emits C1 again",async()=>{
 let calls=0;
 const completeTransport:typeof fetch=async()=>{calls++;return Response.json({data:completed})};
 await assert.rejects(submitVerifiedC1Completion(base,completeTransport));
 assert.equal(calls,1);
 const calls2:string[]=[];
 const forged:typeof fetch=async(_url,init)=>{
  calls2.push(init?.method??"GET");
  return Response.json({data:calls2.length===1?pending:{...completed,centerId:student}});
 };
 const result=await submitVerifiedC1Completion(base,forged);
 assert.equal(result.state,"UNVERIFIED");
 assert.deepEqual(calls2,["GET","POST"]);
});
