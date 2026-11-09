import test from "node:test";
import assert from "node:assert/strict";
import {tosLearningCoreTarget} from "./tos-completion-get-bridge";

const id="01a19a44-20c2-7ae1-a306-a7146f73d95e";
const route="learning/mission-assignments/"+id+"/completion";
const scope={
  centerId:"01a0b29a-3acd-7a18-a0f2-cf6016548ab5",
  studentId:"019d9881-1025-7000-8000-000000000100",
  runningClassId:"019d9881-1025-7000-8000-000000000400",
  localDate:"2026-11-02",
  teachingContextKey:"019d9881-1025-7000-8000-000000000400:2026-11-02",
};

test("PAP-1488 BFF: only Completion GET forwards entire Core scope on query, body empty",()=>{
 const url=new URL("https://tos.staging.pinohouse.art/api/tos-learning/"+route+"?"+new URLSearchParams({...scope,t:"cachebust"}));
 const received=tosLearningCoreTarget("GET",route,url,{...scope});
 assert.deepEqual(received.body,{});
 const core=new URL(received.path,"https://core.test");
 assert.equal(core.pathname,"/"+route);
 assert.deepEqual(Object.fromEntries(core.searchParams),scope);
 assert.equal(core.searchParams.has("t"),false);
});

test("PAP-1488 BFF: malformed, duplicated and unexpected GET query params are preserved for Core to reject",()=>{
 const url=new URL("https://tos.test/api/tos-learning/"+route+"?centerId=first&centerId=second&unknown=bad&t=x");
 const out=tosLearningCoreTarget("GET",route,url,{centerId:"second",unknown:"bad"});
 assert.deepEqual(out.body,{});
 const core=new URL(out.path,"https://core.test");
 assert.deepEqual(core.searchParams.getAll("centerId"),["first","second"]);
 assert.equal(core.searchParams.get("unknown"),"bad");
 assert.equal(core.searchParams.has("t"),false);
});

test("PAP-1488 BFF: without scope, Completion GET forwards no invented query or body",()=>{
 const url=new URL("https://tos.test/api/tos-learning/"+route);
 assert.deepEqual(tosLearningCoreTarget("GET",route,url,{}),{path:"/"+route,body:{}});
});

test("PAP-1488 BFF: existing Assignment list, classroom, eligible and HEAD GET behavior untouched",()=>{
 for(const p of ["learning/mission-assignments","learning/missions/eligible","classroom/day"]){
  const url=new URL("https://tos.test/api/tos-learning/"+p+"?centerId=c&limit=100");
  const body={centerId:"c",limit:100};
  assert.deepEqual(tosLearningCoreTarget("GET",p,url,body),{path:"/"+p,body});
 }
 const h=new URL("https://tos.test/api/tos-learning/"+route+"?centerId=c");
 assert.deepEqual(tosLearningCoreTarget("HEAD",route,h,{centerId:"c"}),{path:"/"+route,body:{centerId:"c"}});
});

test("PAP-1488 BFF: no writer POST/PUT/PATCH route or payload modified by read-only fix",()=>{
 for(const method of ["POST","PUT","PATCH"]){
  const url=new URL("https://tos.test/api/tos-learning/"+route+"?unexpected=x");
  const payload={centerId:"c",completed:true,expectedVersion:0};
  const output=tosLearningCoreTarget(method,route,url,payload);
  assert.deepEqual(output,{path:"/"+route,body:payload});
  assert.strictEqual(output.body,payload);
 }
});

test("PAP-1488 BFF: an invalid Completion route never activates special bridge",()=>{
 const p="learning/mission-assignments/invalid/completion";
 const url=new URL("https://tos.test/api/tos-learning/"+p+"?centerId=c");
 const body={centerId:"c"};
 assert.deepEqual(tosLearningCoreTarget("GET",p,url,body),{path:"/"+p,body});
});
