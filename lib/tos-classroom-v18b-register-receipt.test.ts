import test from "node:test";
import assert from "node:assert/strict";
import {createV18bApiTransport,V18B_WRITE_ADMITTED,V18bCoreError} from "./tos-classroom-v18b-api";

const request={
 centerId:"01a0b29a-3acd-7a18-a0f2-cf6016548ab5",
 runningClassId:"019d9881-1025-7000-8000-000000000400",
 studentId:"019d9881-1025-7000-8000-000000000100",
 pathKey:"019d9880-1025-7000-8000-000000000001",
 teachingContextKey:"019d9881-1025-7000-8000-000000000400:2026-11-02",
};
const originalKey="pap945:qa-recovery-20261103:register";
const diary={
 ...request,id:"01a19a44-faac-7e68-88f8-23e65f491949",status:"REGISTERED",
 version:1,interest:null,notes:null,difficulty:null,
};

test("PAP-1400 receipt lookup works read-only with mutation gate OFF and retains original fingerprint inputs",async()=>{
 const calls:Array<{url:string;method:string|undefined;key:string|null;body:string|undefined}>=[];
 const transport:typeof fetch=async(url,init)=>{
  calls.push({url:String(url),method:init?.method,
   key:new Headers(init?.headers).get("idempotency-key"),
   body:typeof init?.body==="string"?init.body:undefined});
  return new Response(JSON.stringify({data:diary}),{status:200});
 };
 assert.equal(V18B_WRITE_ADMITTED,false);
 const api=createV18bApiTransport(false,transport);
 const found=await api.registerReceipt(request,originalKey);
 assert.equal(found.id,diary.id);
 assert.deepEqual(calls,[{
  url:"/api/tos-learning/learning/path-diaries/register-receipt",
  method:"POST",key:originalKey,body:JSON.stringify(request),
 }]);
 await assert.rejects(api.register(request,originalKey),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===503&&e.code==="CORE_V18B_WRITE_NOT_ADMITTED");
 assert.equal(calls.length,1,"a forbidden write must not reach the transport");
});

test("PAP-1400 receipt lookup rejects missing scope, legacy Mission and extra fields before network",async()=>{
 let calls=0;
 const transport:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({data:diary}));};
 const api=createV18bApiTransport(false,transport);
 await assert.rejects(api.registerReceipt({...request,studentId:""},originalKey),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===400);
 await assert.rejects(api.registerReceipt({...request,mission:"fake"},originalKey),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===409);
 await assert.rejects(api.registerReceipt({...request,extra:"unknown"},originalKey),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===400);
 await assert.rejects(api.registerReceipt(request,""),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===400);
 assert.equal(calls,0);
});

test("PAP-1400 original-key 404 never triggers automatic Register or retry",async()=>{
 let calls=0;
 const transport:typeof fetch=async(_url,init)=>{
  calls++;
  assert.equal(init?.method,"POST");
  return new Response(JSON.stringify({error:{code:"DIARY_REGISTER_RECEIPT_NOT_FOUND",message:"Unknown receipt"}}),{status:404});
 };
 const api=createV18bApiTransport(false,transport);
 await assert.rejects(api.registerReceipt(request,originalKey),
  (e:unknown)=>e instanceof V18bCoreError&&e.status===404&&e.code==="DIARY_REGISTER_RECEIPT_NOT_FOUND");
 assert.equal(calls,1,"unknown receipt must not attempt another request");
});

test("PAP-1400 response mismatch and source denial fail closed without revealing unverified Diary",async()=>{
 for(const row of [
  {status:200,body:{data:{...diary,studentId:"019d9881-1025-7000-8000-000000000999"}},error:502},
  {status:200,body:{data:{...diary,centerId:"0199f001-0000-7000-8000-000000000001"}},error:502},
  {status:403,body:{error:{code:"ACCESS_SURFACE_DENIED",message:"Forbidden"}},error:403},
  {status:409,body:{error:{code:"IDEMPOTENCY_CONFLICT",message:"Changed fingerprint"}},error:409},
  {status:503,body:{error:{code:"CORE_UNAVAILABLE",message:"Unavailable"}},error:503},
 ]){
  let calls=0;
  const transport:typeof fetch=async()=>{calls++;return new Response(JSON.stringify(row.body),{status:row.status});};
  const api=createV18bApiTransport(false,transport);
  await assert.rejects(api.registerReceipt(request,originalKey),
   (e:unknown)=>e instanceof V18bCoreError&&e.status===row.error);
  assert.equal(calls,1);
 }
});
