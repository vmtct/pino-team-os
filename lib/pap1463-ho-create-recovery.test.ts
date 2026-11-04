import test from "node:test";
import assert from "node:assert/strict";
import { HoCreateRecovery, type CreatePayload } from "./ho-shift-template-create-recovery";

const center="018e6b98-fcc3-7ef2-a1e1-63fbadc82130";
const payload:CreatePayload={scopeType:"GLOBAL",centerId:null,code:"PM",displayLabel:"Ca chiều",startLocalTime:"13:00",endLocalTime:"17:00",status:"ACTIVE"};
const row={...payload,id:"018e6b98-fcc3-7ef2-a1e1-63fbadc82132",createdAt:"2026-11-04T00:00:00.000Z",updatedAt:"2026-11-04T00:00:00.000Z"};
const error=(status=503,code="HO_SHIFT_TEMPLATE_UNAVAILABLE")=>Response.json({error:{code}},{status});
test("PAP-1463 unknown close/reopen cannot POST; absent read permits only identical replay",async()=>{
 const requests:RequestInit[]=[];
 const recovery=new HoCreateRecovery();
 const post:typeof fetch=async(_url,init)=>{requests.push(init!);throw Error("network");};
 await recovery.submit(payload,post,()=>"original-key");
 assert.equal(recovery.state,"unknown");
 await recovery.submit(payload,post,()=>"unsafe-new-key");
 assert.equal(requests.length,1);
 await recovery.reconcile(async(url,init)=>{
  assert.match(String(url),/centerId=GLOBAL$/);assert.equal(init?.cache,"no-store");
  return Response.json({data:[]});
 });
 assert.equal(recovery.state,"absent");
 await recovery.submit({...payload,code:"CHANGED"},post,()=>"unsafe-new-key");
 assert.equal(requests.length,1);
 await recovery.submit(payload,post,()=>"unsafe-new-key");
 assert.equal(requests.length,2);
 assert.deepEqual(requests[0],requests[1]);
});
test("PAP-1463 explicit prewrite rejection is editable; unproven 401/403/404 remain unknown",async()=>{
 for(const [status,code] of [[400,"PLATFORM_INVALID_INPUT"],[403,"HO_SHIFT_TEMPLATE_MUTATION_DENIED"],[404,"PLATFORM_NOT_FOUND"],[409,"WORKFORCE_SHIFT_CONFLICT"]] as const){
  const r=new HoCreateRecovery();await r.submit(payload,async()=>error(status,code),()=>"key");assert.equal(r.state,"rejected");
 }
 for(const status of [401,403,404,500,502,503]){
  const r=new HoCreateRecovery();await r.submit(payload,async()=>error(status),()=>"key");assert.equal(r.state,"unknown");
 }
});
test("PAP-1463 GET classifies actual committed, conflicting, duplicate, malformed and unavailable data",async()=>{
 for(const [data,state] of [[[row],"committed"],[[{...row,displayLabel:"Other"}],"conflict"],[[row,{...row,id:center}],"conflict"],[[],"absent"],[[{bad:true}],"unknown"]] as const){
  const r=new HoCreateRecovery();await r.submit(payload,async()=>error(),()=>"key");
  await r.reconcile(async()=>Response.json({data}));assert.equal(r.state,state);
 }
 for(const fetcher of [async()=>error(403),async()=>{throw Error("offline");}]){
  const r=new HoCreateRecovery();await r.submit(payload,async()=>error(),()=>"key");
  await r.reconcile(fetcher);assert.equal(r.state,"unknown");assert.ok(r.diagnostic);
 }
});
test("PAP-1463 exact GLOBAL/CENTER scope and fields never infer cross-scope success",async()=>{
 for(const attempted of [payload,{...payload,scopeType:"CENTER" as const,centerId:center}]){
  for(const readRow of [{...row,scopeType:"CENTER",centerId:center}, {...row,scopeType:"GLOBAL",centerId:null}, {...row,scopeType:"CENTER",centerId:"018e6b98-fcc3-7ef2-a1e1-63fbadc82131"}]){
   const r=new HoCreateRecovery();await r.submit(attempted,async()=>error(),()=>"key");
   await r.reconcile(async()=>Response.json({data:[readRow]}));
   assert.equal(r.state,readRow.scopeType===attempted.scopeType&&readRow.centerId===attempted.centerId?"committed":"unknown");
  }
 }
});
test("PAP-1463 malformed success and replay rejection never clear unknown provenance",async()=>{
 const r=new HoCreateRecovery();await r.submit(payload,async()=>Response.json({data:{}},{status:201}),()=>"key");
 assert.equal(r.state,"unknown");await r.reconcile(async()=>Response.json({data:[]}));
 await r.submit(payload,async()=>error(409,"WORKFORCE_SHIFT_CONFLICT"),()=>"new");assert.equal(r.state,"conflict");assert.match(r.diagnostic,/Receipt.*POST 409/);
});
test("PAP-1463 every attempted field must match; 409 never means success",async()=>{
 for(const patch of [{displayLabel:"Changed"},{startLocalTime:"14:00"},{endLocalTime:"18:00"},{status:"INACTIVE"}]){
  const r=new HoCreateRecovery();await r.submit(payload,async()=>error(),()=>"key");
  await r.reconcile(async()=>Response.json({data:[{...row,...patch}]}));assert.equal(r.state,"conflict");
  let called=false;await r.submit(payload,async()=>{called=true;return Response.json({data:row},{status:201});},()=>"new");
  assert.equal(called,false);
 }
 const r=new HoCreateRecovery();await r.submit(payload,async()=>error(409,"WORKFORCE_SHIFT_CONFLICT"),()=>"key");
 assert.equal(r.state,"rejected");
 await r.submit({...payload,code:"CORRECTED"},async(_url,init)=>{
  assert.equal((init?.headers as Record<string,string>)["idempotency-key"],"corrected-key");
  assert.equal(JSON.parse(String(init?.body)).code,"CORRECTED");return error(400,"PLATFORM_INVALID_INPUT");
 },()=>"corrected-key");assert.equal(r.state,"rejected");
});
test("PAP-1463 in-flight guard prevents double POST and GET races",async()=>{
 const r=new HoCreateRecovery();let release!:(value:Response)=>void;let calls=0;
 const first=r.submit(payload,async()=>{calls++;return new Promise(resolve=>{release=resolve;});},()=>"key");
 await r.submit(payload,async()=>{calls++;return error();},()=>"new");
 await r.reconcile(async()=>{calls++;return Response.json({data:[]});});
 assert.equal(calls,1);release(Response.json({data:row},{status:201}));await first;assert.equal(r.state,"committed");
});