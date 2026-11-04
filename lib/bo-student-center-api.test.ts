import test from "node:test";
import assert from "node:assert/strict";
import { studentCenterApi } from "./bo-student-center-api";
import { BoApiError } from "./bo-api-error";
const studentId="0198d050-56c1-7ac5-b9ab-b0e45d912345";
const centerId="01912345-6789-7abc-8def-0123456789ab";
test("Student Center adapter uses explicit scoped URL for list and detail",async()=>{
  const urls:string[]=[];
  const fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
    urls.push(String(input));
    if(init?.method)throw Error("Expected GET");
    return new Response(JSON.stringify({data:urls.length===1?[]:{student:{id:studentId}}}),{status:200});
  };
  await studentCenterApi.learners("",25,undefined,centerId,fetcher as typeof fetch);
  await studentCenterApi.learnerLifecycle(studentId,centerId,fetcher as typeof fetch);
  assert.equal(urls.length,2);
  assert.match(urls[0]!,/learners\?limit=25&centerId=/);
  assert.match(urls[1]!,/students\/.+\/lifecycle\?centerId=/);
  assert.ok(urls.every(url=>url.includes(centerId)));
});
test("Student Center adapter sends name-only PATCH and rejects absent Center",async()=>{
  const calls:Array<{url:string;method?:string;body:unknown}>=[];
  const fetcher=async(input:RequestInfo|URL,init?:RequestInit)=>{
    calls.push({url:String(input),method:init?.method,body:init?.body&&JSON.parse(String(init.body))});
    return new Response(JSON.stringify({data:{id:studentId,status:"ACTIVE",version:2}}),{status:200});
  };
  const nameOnly={displayName:"New Name",expectedVersion:1};
  await studentCenterApi.updateStudentProfile(studentId,nameOnly,centerId,fetcher as typeof fetch);
  assert.deepEqual(calls[0]?.body,nameOnly);
  assert.equal(calls[0]?.method,"PATCH");
  assert.ok(calls[0]?.url.includes("centerId="+centerId));
  assert.throws(()=>studentCenterApi.updateStudentProfile(studentId,nameOnly,"",fetcher as typeof fetch),BoApiError);
  assert.equal(calls.length,1);
});
test("Denied Core responses remain classified as BO API errors",async()=>{
  const fetcher=async()=>new Response(JSON.stringify({error:{message:"Denied"}}),{status:403});
  await assert.rejects(()=>studentCenterApi.updateStudentProfile(studentId,{displayName:"Denied",expectedVersion:1},centerId,fetcher as typeof fetch),error=>error instanceof BoApiError&&error.status===403);
});

test("PAP-1426 Student Center edit capability must read explicit Core decision, never permissionKeys union",async()=>{
  const urls:string[]=[];
  const fetcher=async(input:RequestInfo|URL)=>{
    urls.push(String(input));
    return new Response(JSON.stringify({data:{permissionKeys:["student.profile.edit"],studentProfileEditAllowed:false}}),{status:200});
  };
  assert.equal(await studentCenterApi.editCapability(centerId,fetcher as typeof fetch),false);
  assert.deepEqual(urls,[`/api/bo/context?centerId=${centerId}`]);
  const granted=async()=>new Response(JSON.stringify({data:{studentProfileEditAllowed:true}}),{status:200});
  assert.equal(await studentCenterApi.editCapability(centerId,granted as typeof fetch),true);
  const missing=async()=>new Response(JSON.stringify({data:{permissionKeys:["student.profile.edit"]}}),{status:200});
  assert.equal(await studentCenterApi.editCapability(centerId,missing as typeof fetch),false);
});
test("PAP-1426 Student capability fails closed for unauthorized, missing or malformed Center",async()=>{
  let calls=0;
  const forbidden=async()=>{calls++;return new Response(JSON.stringify({error:{message:"Not allowed"}}),{status:403});};
  await assert.rejects(()=>studentCenterApi.editCapability(centerId,forbidden as typeof fetch),(error:unknown)=>error instanceof BoApiError&&error.status===403);
  assert.equal(calls,1);
  await assert.rejects(()=>studentCenterApi.editCapability("",forbidden as typeof fetch),BoApiError);
  assert.equal(calls,1);
});
