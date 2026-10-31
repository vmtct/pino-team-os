import test from "node:test";
import assert from "node:assert/strict";
import {tosLearningApi} from "./tos-learning-api";
import {walkinPassTosApi} from "./open-studio-walkin-tos-api";

test("Classroom client remains read-only and walk-in commands are isolated",()=>{
 assert.deepEqual(Object.keys(tosLearningApi).sort(),["learningOptions","roster","sessionsDay"]);
 assert.deepEqual(Object.keys(walkinPassTosApi).sort(),["consume","lookup"]);
});
test("TOS walk-in lookup goes only to TOS facade",async()=>{
 const original=globalThis.fetch;
 const requests:Array<[string,RequestInit]>=[];
 globalThis.fetch=(async(url:string,init:RequestInit)=>{
  requests.push([url,init]);
  return Response.json({data:{pass:{id:"p1",code:"PINO-OS-001",status:"ASSIGNED",path_code:"AC",parent_user_id:"p"},students:[],parentName:"Parent"}});
 }) as typeof fetch;
 try{
  const data=await walkinPassTosApi.lookup("center-1","PINO-OS-001");
  assert.equal(data.pass.path_code,"AC");
  assert.match(requests[0]![0],/^\/api\/tos-learning\/open-studio\/walkin\/lookup\?/);
  assert.match(requests[0]![0],/centerId=center-1/);
  assert.equal(requests[0]![1].cache,"no-store");
 }finally{globalThis.fetch=original}
});
test("TOS consume carries explicit payload and idempotency key to TOS facade",async()=>{
 const original=globalThis.fetch;
 const captured:Array<[string,RequestInit]>=[];
 globalThis.fetch=(async(url:string,init:RequestInit)=>{
  captured.push([url,init]);
  return Response.json({data:{id:"p1",status:"CONSUMED",child_name:"An Nhiên",student_id:"s1"}});
 }) as typeof fetch;
 try{
  await walkinPassTosApi.consume({centerId:"center-1",code:"PINO-OS-001",shiftId:"shift-1",confirmedHolder:true,studentId:"s1"});
  assert.equal(captured.length,1);
  const [url,opts]=captured[0]!;
  assert.equal(url,"/api/tos-learning/open-studio/walkin/consume");
  assert.equal(opts.method,"POST");
  assert.equal((opts.headers as Record<string,string>)["content-type"],"application/json");
  assert.ok((opts.headers as Record<string,string>)["idempotency-key"]);
  assert.equal(JSON.parse(opts.body as string).studentId,"s1");
  assert.equal(JSON.parse(opts.body as string).shiftId,"shift-1");
 }finally{globalThis.fetch=original}
});

test("PAP-1250 consume without shift does not synthesize Workforce attendance",async()=>{
 const original=globalThis.fetch;
 let payload:Record<string,unknown>|null=null;
 globalThis.fetch=(async(_url:string,init:RequestInit)=>{
  payload=JSON.parse(String(init.body));
  return Response.json({data:{id:"pass-1",status:"CONSUMED",child_name:"An",student_id:null}});
 }) as typeof fetch;
 try{
  const result=await walkinPassTosApi.consume({centerId:"center-1",code:"PINO-OS-001",confirmedHolder:true,manualChildName:"An"});
  assert.equal(result.status,"CONSUMED");
  const submitted=payload as Record<string,unknown> | null;
  assert.equal(submitted?.["shiftId"],undefined);
  assert.equal(submitted?.["confirmedHolder"],true);
 }finally{globalThis.fetch=original}
});
