import test from "node:test";
import assert from "node:assert/strict";
import {tosMissionCompletionGetRequest} from "./tos-mission-completion-facade-get";

const assignment="01a1bdfc-808f-7e7c-8833-2831bb891456";
const route="learning/mission-assignments/"+assignment+"/completion";
const scope=new URLSearchParams({
  centerId:"01a0b29a-3acd-7a18-a0f2-cf6016548ab5",
  studentId:"019d9881-1025-7000-8000-000000000101",
  runningClassId:"019d9881-1025-7000-8000-000000000401",
  localDate:"2026-11-17",
  teachingContextKey:"019d9881-1025-7000-8000-000000000401:2026-11-17",
});

test("PAP-1488: Core Completion GET carries scope in route query with EMPTY body",()=>{
  const out=tosMissionCompletionGetRequest("GET",route,
    new URL("https://tos.staging.pinohouse.art/api/tos-learning/"+route+"?"+scope));
  assert.deepEqual(out,{path:"/"+route+"?"+scope.toString(),body:{}});
  assert.equal(Object.keys(out!.body).length,0);
});

test("PAP-1488: Core sees duplicate/unknown query for validation, not collapsed",()=>{
  const url=new URL("https://example.invalid/api/tos-learning/"+route+"?"+scope);
  url.searchParams.append("centerId","foreign");
  url.searchParams.append("unknown","private");
  const out=tosMissionCompletionGetRequest("GET",route,url)!;
  const forwarded=new URL("https://core.local.invalid"+out.path);
  assert.equal(forwarded.searchParams.getAll("centerId").length,2);
  assert.equal(forwarded.searchParams.get("unknown"),"private");
});

test("PAP-1488: Team cache-busting t removed, never forwarded as Core permission",()=>{
  const url=new URL("https://example.invalid/api/tos-learning/"+route+"?"+scope);
  url.searchParams.set("t","1760000000");
  const out=tosMissionCompletionGetRequest("GET",route,url)!;
  assert.equal(new URL("https://core.local.invalid"+out.path).searchParams.has("t"),false);
});

test("PAP-1488: all other TOS operations retain existing facade query-to-body behavior",()=>{
  const url=new URL("https://example.invalid?"+scope);
  for(const [method,path] of [
    ["POST",route],["PUT",route],["GET","classroom/day"],
    ["GET","learning/mission-assignments"],
    ["GET","learning/mission-assignments/"+assignment+"/completion-history"],
    ["GET","learning/mission-assignments/not-a-canonical-id/completion"],
  ])assert.equal(tosMissionCompletionGetRequest(method,path,url),null);
});
