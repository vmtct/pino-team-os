import test from "node:test";
import assert from "node:assert/strict";
import { surfaceSession } from "./workspace-adapters/session";

const origin="https://ho.staging.pinohouse.art";
const center="018e6b98-fcc3-7ef2-a1e1-63fbadc82130";
test("PAP-1255 HO TDD transport permits only Center-scoped template GET",async()=>{
 const calls:string[]=[];
 const fetcher:typeof fetch=async(input)=>{calls.push(String(input));return Response.json({data:[]});};
 const s=surfaceSession("HO",origin,fetcher);
 const accepted="/api/ho/workforce/shift-templates?centerId="+center;
 assert.equal((await s.transport(accepted)).status,200);
 assert.deepEqual(calls,[origin+accepted]);
 for(const url of ["/api/ho/workforce/shift-templates",accepted+"&centerId="+center,
   accepted+"&unknown=x","/api/ho/workforce/shift-templates?centerId=invalid",
   "/api/ho/workforce/global-termweeks", "https://bo.staging.pinohouse.art"+accepted])
   await assert.rejects(s.transport(url),{status:404});
 for(const method of ["POST","PATCH","DELETE"])
   await assert.rejects(s.transport(accepted,{method}),{status:404});
 assert.equal(calls.length,1);
 s.dispose();
});
