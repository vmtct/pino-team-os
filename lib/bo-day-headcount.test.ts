import test from "node:test";
import assert from "node:assert/strict";
import { handleBoOperationalReadRequest } from "./bo-read-handler";
import { decideHostBoundary } from "./host-boundary";
import type { BoAccessCoreBinding, BoAccessRequest } from "./bo-core";

const base = "https://bo.staging.pinohouse.art/api/bo/classroom/day-headcounts";
const path = "classroom/day-headcounts";
const centerId = "01912345-6789-7abc-8def-0123456789ab";
const date = "2026-11-16";
const request = (query: string, cookie = true, method = "GET") => new Request(base + query, {
  method, headers: cookie ? { cookie: "pino_staff_password_session=local-password-session" } : {},
});

test("PAP-1939 · Epic PAP-1064 BO day-counts read forwards only exact authorized Center/date", async () => {
  const forwarded: BoAccessRequest[] = [];
  const core: BoAccessCoreBinding = {
    async executeWithStaffPassword(input) { forwarded.push(input); return {status:200,body:{data:{centerId,localDate:date,rows:[],coverage:"PROJECTED_ENROLLMENTS_GRACE_AND_MANUAL_ONLY",diagnostics:[]}},requestId:"pap1939"}; },
  };
  const env = { PINO_BO_CORE: core };
  const ok = await handleBoOperationalReadRequest(request("?centerId="+centerId+"&localDate="+date),env,path);
  assert.equal(ok.status,200);
  assert.deepEqual(forwarded,[{method:"GET",path,resource:{centerId},body:{centerId,localDate:date}}]);
  assert.equal((await handleBoOperationalReadRequest(request("?centerId="+centerId+"&localDate="+date,false),env,path)).status,401); // Auth gate precedes Core and scope parsing
  for(const query of ["", "?centerId="+centerId, "?localDate="+date, "?centerId=bad&localDate="+date, "?centerId="+centerId+"&centerId="+centerId+"&localDate="+date, "?centerId="+centerId+"&localDate="+date+"&userId=forged", "?centerId="+centerId+"&localDate=2026-02-30", "?centerId="+centerId+"&localDate="+date+"&localDate="+date]){
    assert.equal((await handleBoOperationalReadRequest(request(query),env,path)).status,400,query);
  }
  assert.equal((await handleBoOperationalReadRequest(request("?centerId="+centerId+"&localDate="+date,true,"POST"),env,path)).status,405);
  assert.equal(forwarded.length,1);
});
test("PAP-1939 exact BO Staging host GET fence does not allow HO/TOS/Prod/descendants",()=>{
  assert.equal(decideHostBoundary("bo.staging.pinohouse.art","/api/bo/classroom/day-headcounts","GET").action,"next");
  for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art"]){
    assert.equal(decideHostBoundary(host,"/api/bo/classroom/day-headcounts","GET").action,"not_found",host);
  }
  assert.equal(decideHostBoundary("bo.staging.pinohouse.art","/api/bo/classroom/day-headcounts","POST").action,"not_found");
  assert.equal(decideHostBoundary("bo.staging.pinohouse.art","/api/bo/classroom/day-headcounts/forged","GET").action,"not_found");
});
