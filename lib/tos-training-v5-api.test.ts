import test from "node:test";
import assert from "node:assert/strict";
import {tosTrainingV5Api,TrainingV5ApiError,TRAINING_V5_WRITE_ADMITTED} from "./tos-training-v5-api";

test("PAP-946 read uses authenticated self-scoped Core V5 facade and no staff ID",async()=>{
 const old=globalThis.fetch;const calls:Array<{url:string;method:string}>=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init:RequestInit={})=>{
  calls.push({url:String(input),method:init.method??"GET"});
  const data=String(input).includes("catalog")?{items:[],total:0,limit:20,offset:0}:[];
  return new Response(JSON.stringify({data}),{status:200,headers:{"content-type":"application/json"}});
 }) as typeof fetch;
 try{
  const catalog=await tosTrainingV5Api.catalog({query:"Art",popularOnly:true,limit:20});
  assert.equal(catalog.total,0);
  assert.deepEqual(await tosTrainingV5Api.registrations(),[]);
  assert.equal(calls.length,2);
  assert.ok(calls[0].url.includes("query=Art"));
  assert.ok(calls[0].url.includes("popularOnly=true"));
  assert.equal(calls.some(c=>/staffId|staffMemberId|userId/.test(c.url)),false);
  assert.ok(calls.every(c=>c.method==="GET"));
 }finally{globalThis.fetch=old}
});
test("PAP-946 unavailable V5 must propagate 404/403, never fake empty successful state",async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=(async()=>new Response(JSON.stringify({error:{code:"NOT_FOUND",message:"Not deployed"}}),
  {status:404,headers:{"content-type":"application/json"}})) as typeof fetch;
 try{
  await assert.rejects(tosTrainingV5Api.catalog(),(error:unknown)=>
   error instanceof TrainingV5ApiError&&error.status===404&&error.code==="NOT_FOUND");
 }finally{globalThis.fetch=old}
});
test("PAP-946 fails closed before any registration/cancellation write",async()=>{
 assert.equal(TRAINING_V5_WRITE_ADMITTED,false);
 const old=globalThis.fetch;let called=false;
 globalThis.fetch=(async()=>{called=true;throw new Error("Unexpected network write");}) as typeof fetch;
 try{
  await assert.rejects(tosTrainingV5Api.register("module-1","stable-key"),(e:unknown)=>
   e instanceof TrainingV5ApiError&&e.code==="CORE_V5_WRITE_NOT_ADMITTED");
  await assert.rejects(tosTrainingV5Api.cancel("registration-1",1,"stable-key"),(e:unknown)=>
   e instanceof TrainingV5ApiError&&e.code==="CORE_V5_WRITE_NOT_ADMITTED");
  assert.equal(called,false);
 }finally{globalThis.fetch=old}
});
test("PAP-946 eligibility requires module ID and preserves server authority",async()=>{
 await assert.rejects(tosTrainingV5Api.eligibility(" "),(e:unknown)=>
  e instanceof TrainingV5ApiError&&e.status===400);
});

test('PAP-946 eligibility normalizes surrounding module whitespace',async()=>{
 const old=globalThis.fetch;let url='';
 globalThis.fetch=(async(input:RequestInfo|URL)=>{url=String(input);return new Response(JSON.stringify({data:{moduleId:'module-1',eligible:true}}),{status:200})}) as typeof fetch;
 try{await tosTrainingV5Api.eligibility('  module-1  ');assert.ok(url.endsWith('moduleId=module-1'));}finally{globalThis.fetch=old}
});

test('PAP-946 invalid catalog pagination fails before Core fetch',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=(async()=>{calls++;throw new Error('unexpected fetch')}) as typeof fetch;
 try{for(const input of [{limit:0},{limit:1.5},{offset:-1},{offset:NaN}])await assert.rejects(tosTrainingV5Api.catalog(input),(e:unknown)=>e instanceof TrainingV5ApiError&&e.code==='INVALID_PAGINATION');assert.equal(calls,0);}finally{globalThis.fetch=old}
});

test('PAP-946 combines Core catalog query and Path filters',async()=>{
 const old=globalThis.fetch;let uri='';
 globalThis.fetch=(async(input:RequestInfo|URL)=>{uri=String(input);return new Response(JSON.stringify({data:{items:[],total:0,limit:30,offset:0}}),{status:200})}) as typeof fetch;
 try{await tosTrainingV5Api.catalog({query:'  sketch  ',path:'  ART-01  '});const url=new URL(uri,'https://local.test');assert.equal(url.searchParams.get('query'),'sketch');assert.equal(url.searchParams.get('path'),'ART-01');}finally{globalThis.fetch=old}
});
test("PAP-946 eligibility returns Core prerequisite and hour deficits without local inference",async()=>{
 const old=globalThis.fetch;
 const expected={moduleId:"module-3",eligible:false,confirmedHours:1,requiredHours:5,missingHours:4,missingPrerequisiteModuleIds:["module-1"],reason:"MISSING_PREREQUISITES"};
 globalThis.fetch=(async()=>new Response(JSON.stringify({data:expected}),{status:200})) as typeof fetch;
 try{assert.deepEqual(await tosTrainingV5Api.eligibility("module-3"),expected)}finally{globalThis.fetch=old}
});
test("PAP-946 catalog pagination sends the requested Core window",async()=>{
 const old=globalThis.fetch;let uri="";
 globalThis.fetch=(async(input:RequestInfo|URL)=>{uri=String(input);return new Response(JSON.stringify({data:{items:[],total:72,limit:30,offset:30}}),{status:200})}) as typeof fetch;
 try{const page=await tosTrainingV5Api.catalog({query:"art",limit:30,offset:30});const params=new URL(uri,"https://local.test").searchParams;assert.equal(params.get("limit"),"30");assert.equal(params.get("offset"),"30");assert.equal(page.total,72);assert.equal(page.offset,30);}finally{globalThis.fetch=old}
});
test("PAP-946 eligibility 403 is not converted to locally inferred approval",async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=(async()=>new Response(JSON.stringify({error:{code:"FORBIDDEN",message:"Not authorized"}}),{status:403})) as typeof fetch;
 try{await assert.rejects(tosTrainingV5Api.eligibility("module-1"),(error:unknown)=>error instanceof TrainingV5ApiError&&error.status===403&&error.code==="FORBIDDEN")}finally{globalThis.fetch=previous}
});
test("PAP-946 eligibility 503 keeps unavailable Core separate from approval",async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=(async()=>new Response(JSON.stringify({error:{code:"SERVICE_UNAVAILABLE",message:"Core unavailable"}}),{status:503})) as typeof fetch;
 try{await assert.rejects(tosTrainingV5Api.eligibility("module-2"),(error:unknown)=>error instanceof TrainingV5ApiError&&error.status===503&&error.code==="SERVICE_UNAVAILABLE")}finally{globalThis.fetch=previous}
});