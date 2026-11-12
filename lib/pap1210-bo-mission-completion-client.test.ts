import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBoMissionExecution, readBoMissionExecution, readBoMissionCompletionHistory,
  reopenBoMissionCompletion, type BoMissionReopenCommand,
} from "./bo-mission-completion-client";

const center="01900000-0000-7000-8000-000000000001";
const assignment="01900000-0000-7000-8000-000000000002";
const actor="01900000-0000-7000-8000-000000000003";
const eventId="01900000-0000-7000-8000-000000000004";
const another="01900000-0000-7000-8000-000000000005";
const t="2026-11-09T00:00:00.000Z";
const execution={assignmentId:assignment,centerId:center,assignmentStatus:"ASSIGNED",
  executionStatus:"COMPLETED",executionVersion:1,updatedAt:t,updatedByUserId:actor};
const history=[{id:eventId,assignmentId:assignment,centerId:center,version:2,
  action:"REOPEN",source:"BO",statusBefore:"COMPLETED",statusAfter:"IN_PROGRESS",
  actorUserId:actor,reason:"Chưa đạt yêu cầu bài tập",occurredAt:t}];
const cmd:BoMissionReopenCommand={centerId:center,assignmentId:assignment,
  expectedVersion:1,reason:"Chưa đạt yêu cầu bài tập",idempotencyKey:"pap1210-reopen-key-00001"};
const reply=(data:unknown,status=200)=>Response.json({data},{status});

test("PAP-1210 BO Completion: accept the initial independent IN_PROGRESS projection (not AssignmentStatus)",()=>{
  const initial={...execution,executionStatus:"IN_PROGRESS",executionVersion:0,updatedAt:null,updatedByUserId:null};
  assert.deepEqual(parseBoMissionExecution(initial,center,assignment),initial);
  assert.throws(()=>parseBoMissionExecution({...initial,assignmentStatus:"COMPLETED"},center,assignment));
  assert.throws(()=>parseBoMissionExecution({...initial,executionVersion:1},center,assignment));
  assert.throws(()=>parseBoMissionExecution({...execution,centerId:another},center,assignment));
  assert.throws(()=>parseBoMissionExecution({...execution,assignmentId:another},center,assignment));
  assert.throws(()=>parseBoMissionExecution({...execution,updatedAt:"nope"},center,assignment));
});

test("PAP-1210 BO Completion: Center-scoped GET parses projection and bounded history",async()=>{
  const urls:string[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
    urls.push(String(input));
    assert.equal(init?.method,"GET");
    return reply(String(input).includes("completion-history")?history:execution);
  };
  const signal=new AbortController().signal;
  assert.deepEqual(await readBoMissionExecution(fetcher,center,assignment,signal),execution);
  assert.deepEqual(await readBoMissionCompletionHistory(fetcher,center,assignment,signal),history);
  assert.match(urls[0]!,/\/execution\?centerId=/);
  assert.match(urls[1]!,/\/completion-history\?centerId=/);
  assert.match(urls[1]!,/limit=100&offset=0/);
});

test("PAP-1210 BO Completion: verified reopen requires exact POST, then independent GET and audited event",async()=>{
  const calls:Array<{path:string;method:string;key:string|null;body?:unknown}>=[];
  const after={...execution,executionStatus:"IN_PROGRESS",executionVersion:2};
  const fetcher:typeof fetch=async(input,init)=>{
    const path=String(input),method=init?.method??"GET";
    calls.push({path,method,key:new Headers(init?.headers).get("idempotency-key"),
      ...(init?.body?{body:JSON.parse(String(init.body))}:{})});
    if(method==="POST")return reply(after);
    return reply(path.includes("completion-history")?history:after);
  };
  const result=await reopenBoMissionCompletion(cmd,fetcher);
  assert.equal(result.state,"verified");
  if(result.state==="verified"){assert.deepEqual(result.execution,after);assert.deepEqual(result.event,history[0]);}
  assert.equal(calls.length,3);
  assert.equal(calls[0]?.method,"POST");
  assert.equal(calls[0]?.path,"/api/bo/learning/mission-assignments/"+assignment+"/reopen");
  assert.equal(calls[0]?.key,cmd.idempotencyKey);
  assert.deepEqual(calls[0]?.body,{centerId:center,expectedVersion:1,reason:cmd.reason});
  assert.equal(calls[1]?.method,"GET");
  assert.equal(calls[2]?.method,"GET");
});

test("PAP-1210 BO Completion: deny invalid, unrelated, stale or unverified outcomes without replay",async()=>{
  let calls=0;const noop:typeof fetch=async()=>{calls++;return reply(execution)};
  for(const invalid of [
    {...cmd,centerId:"wrong"}, {...cmd,assignmentId:"wrong"},
    {...cmd,expectedVersion:0},{...cmd,reason:"short"},
    {...cmd,reason:"x".repeat(501)}, {...cmd,idempotencyKey:"bad"},
  ])assert.equal((await reopenBoMissionCompletion(invalid,noop)).state,"invalid");
  assert.equal(calls,0);
  const unverifiedCases:[typeof fetch,string][]=[
    [async()=>{throw Error("network")}, "unverified"],
    [async()=>reply({},409),"conflict"],
    [async()=>reply({},403),"denied"],
    [async()=>reply({},400),"invalid"],
    [async()=>reply({},503),"unverified"],
    [async(input,init)=>reply(init?.method==="POST"?{...execution,executionVersion:2,executionStatus:"IN_PROGRESS"}:
      {...execution,executionVersion:3,executionStatus:"COMPLETED"}),"unverified"],
    [async(input)=>reply(String(input).includes("completion-history")?[{...history[0],reason:"OTHER"}]:
      {...execution,executionVersion:2,executionStatus:"IN_PROGRESS"}),"unverified"],
    [async(input)=>reply(String(input).includes("completion-history")?[{...history[0],actorUserId:another}]:
      {...execution,executionVersion:2,executionStatus:"IN_PROGRESS"}),"unverified"],
  ];
  for(const [fetcher,state] of unverifiedCases){
    let attempts=0;
    const single:typeof fetch=async(i,init)=>{if(init?.method==="POST")attempts++;return fetcher(i,init)};
    assert.equal((await reopenBoMissionCompletion(cmd,single)).state,state);
    assert.equal(attempts,1,"never replay a BO command automatically");
  }
});

test("PAP-1210 BO Completion: reject forged history, wrong Center and partial history",async()=>{
  const invalid=[{...history[0],source:"TOS"}, {...history[0],statusBefore:"IN_PROGRESS"},
    {...history[0],actorUserId:"unknown"}, {...history[0],centerId:another}];
  for(const event of invalid){
    const fetcher:typeof fetch=async()=>reply([event]);
    await assert.rejects(readBoMissionCompletionHistory(fetcher,center,assignment,new AbortController().signal));
  }
  const duplicate:typeof fetch=async()=>reply(Array.from({length:100},()=>history[0]));
  await assert.rejects(readBoMissionCompletionHistory(duplicate,center,assignment,new AbortController().signal));
});
