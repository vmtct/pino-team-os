/** PAP-1418/PAP-1419 PNR-TV PAP-650: exact HO TDD transport route/host/Center negative. */
import assert from "node:assert/strict";
import test from "node:test";
import {surfaceSession} from "./workspace-adapters/session";

const origin="https://ho.staging.pinohouse.art";
const centerId="019b1126-0001-7000-8000-000000000001";
test("PAP-1419 Founder HO TDD session transports only exact 3 TV GET BFF resources",async()=>{
 const calls:string[]=[];
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));calls.push(url.pathname+url.search);
  assert.equal(url.origin,origin);assert.equal(init?.method,"GET");
  assert.equal(init?.credentials,"same-origin");
  assert.equal(init?.cache,"no-store");
  assert.equal(init?.redirect,"error");
  return Response.json({data:[]});
 };
 const session=surfaceSession("HO",origin,fetcher);
 try{
  for(const path of[
   "/api/ho/pinoria/tv-health/devices",
   "/api/ho/pinoria/tv-health/displays",
   "/api/ho/pinoria/tv-health/operator-health?centerId="+centerId,
  ]){const response=await session.transport(path,{method:"GET"});assert.equal(response.status,200);}
  assert.equal(calls.length,3);
 }finally{session.dispose();}
});
test("PAP-1419 forbids wrong host, mutation, invalid Center, duplicate filters before network",async()=>{
 let calls=0;
 const fetcher:typeof fetch=async()=>{calls++;return Response.json({data:[]})};
 const session=surfaceSession("HO",origin,fetcher);
 try{
  for(const [path,method] of [
   ["/api/ho/pinoria/tv-health/devices","POST"],
   ["/api/ho/pinoria/tv-health/devices?centerId="+centerId,"GET"],
   ["/api/ho/pinoria/tv-health/operator-health","GET"],
   ["/api/ho/pinoria/tv-health/operator-health?centerId=bad","GET"],
   ["/api/ho/pinoria/tv-health/operator-health?centerId="+centerId+"&centerId="+centerId,"GET"],
   ["/api/ho/pinoria/tv-health/operator-health?centerId="+centerId+"&x=1","GET"],
   ["/api/ho/pinoria/tv-health/private","GET"],
   ["https://bo.staging.pinohouse.art/api/ho/pinoria/tv-health/displays","GET"],
  ] as const){await assert.rejects(session.transport(path,{method}));}
  assert.equal(calls,0);
 }finally{session.dispose();}
});
test("PAP-1419 refuses forged Authorization/Cookie even for exact allowed BFF GET",async()=>{
 let calls=0;
 const session=surfaceSession("HO",origin,async()=>{calls++;return Response.json({data:[]})});
 try{
  for(const headers of [{authorization:"Bearer evil"},{cookie:"admin=true"},{"x-pino-surface":"HO"}]){
   await assert.rejects(session.transport("/api/ho/pinoria/tv-health/devices",{method:"GET",headers}));
  }
  assert.equal(calls,0);
 }finally{session.dispose();}
});
