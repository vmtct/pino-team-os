// PAP-2358 · WFM-STAFF. Synthetic Center directory contract.
import test from "node:test";
import assert from "node:assert/strict";
import {projectManualStaffCenters,readManualStaffCenters} from "./manual-staff-centers";
const id=(n:number)=>"01912345-6789-7abc-8def-"+String(n).padStart(12,"0");
const active={id:id(1),key:"qa",displayName:" QA Center ",status:"active"};
const inactive={...active,id:id(2),status:"inactive"};
test("only authoritative active Centers become options",()=>{
 assert.deepEqual(projectManualStaffCenters({data:[active,inactive]}),[{id:id(1),label:"QA Center"}]);
 assert.deepEqual(projectManualStaffCenters({data:[inactive]}),[]);
});
test("invalid or duplicate Center never becomes selectable",()=>{
 for(const data of [[active,active],[{...active,status:undefined}],[{...active,id:"m1-staff-center"}],[{...active,status:"unknown"}]])
  assert.throws(()=>projectManualStaffCenters({data}));
});
test("existing endpoint only, no fallback for denied or cancelled request",async()=>{
 const ctl=new AbortController();
 assert.deepEqual(await readManualStaffCenters(async(url,init)=>{
  assert.equal(url,"/api/bo/centers");assert.equal(init?.method,"GET");assert.equal(init?.cache,"no-store");
  return Response.json({data:[active]});
 },ctl.signal),[{id:id(1),label:"QA Center"}]);
 await assert.rejects(readManualStaffCenters(async()=>new Response(null,{status:403})));
 ctl.abort();await assert.rejects(readManualStaffCenters(async()=>Response.json({data:[active]}),ctl.signal));
});
