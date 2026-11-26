import test from "node:test";
import assert from "node:assert/strict";
import {surfaceSession} from "./workspace-adapters/session";
const origin="https://ho.staging.pinohouse.art",root="/api/ho/staff/directory",id="019a0000-0000-7000-8000-000000000003";
test("PAP-2395 exact HO directory GET list/detail, no sibling, query, wrong host or mutation",async()=>{
 const calls:string[]=[];const session=surfaceSession("HO",origin,async(url,init)=>{calls.push(String(url));assert.equal(init?.method,"GET");return Response.json({data:null});});
 try{
  await session.transport(root,{method:"GET"});await session.transport(root+"/"+id,{method:"GET"});
  for(const [path,method] of [[root,"POST"],[root,"HEAD"],[root+"/","GET"],[root+"?centerId="+id,"GET"],[root+"/"+id+"?x=1","GET"],[root+"/"+id+"/extra","GET"],[root+"/invalid","GET"],[root+"/019a0000-0000-4000-8000-000000000003","GET"],["/api/ho/staff/create","POST"],["/api/ho/staff/create/receipt","POST"],["https://bo.staging.pinohouse.art"+root,"GET"]])await assert.rejects(session.transport(path,{method}),{status:404});
  assert.deepEqual(calls,[origin+root,origin+root+"/"+id]);
 }finally{session.dispose();}
});