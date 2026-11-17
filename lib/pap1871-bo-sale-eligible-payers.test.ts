/** PAP-1871 / PAP-1491 — selected Center and Student read-only BO Sale payer contract. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {decideHostBoundary} from "./host-boundary";
import {isOperationalReadPath,readCorePath,readQueryBody,readQueryResource} from "./bo-read-handler";

const base="/api/bo/billing/sales/eligible-payers";
const route="billing/sales/eligible-payers";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const student="01a1d9ae-9940-7b00-8b80-000000014981";
const query="?centerId="+center+"&studentProfileId="+student;
const url=(suffix:string)=>new URL("https://bo.staging.pinohouse.art"+base+suffix);

test("PAP-1871 BO Staging exact GET only; no writing or other host",()=>{
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",base,"GET"),{action:"next"});
  for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art",
    "other.staging.pinohouse.art","evil.bo.staging.pinohouse.art"])
    assert.deepEqual(decideHostBoundary(host,base,"GET"),{action:"not_found"},host);
  for(const method of ["POST","PATCH","PUT","DELETE","HEAD"])
    assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",base,method),{action:"not_found"},method);
  for(const suffix of ["/","/list","/create","-other"])
    assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",base+suffix,"GET"),{action:"not_found"},suffix);
  assert.equal(isOperationalReadPath(route),true);
  assert.equal(isOperationalReadPath(route+"/more"),false);
  assert.equal(isOperationalReadPath("billing/sales"),false);
});

test("PAP-1871 only exact two UUID query keys reach Core path plus selected Center resource",()=>{
  const good=url(query);
  assert.deepEqual(readQueryResource(route,good),{centerId:center});
  assert.equal(readCorePath(route,good),route+query);
  assert.equal(readQueryBody(route,good),undefined);
  for(const suffix of ["","?centerId="+center,"?studentProfileId="+student,
    "?centerId=bad&studentProfileId="+student,
    "?centerId="+center+"&studentProfileId=not-uuid",
    query+"&centerId="+center,
    query+"&studentProfileId="+student,
    query+"&userId=founder",
    query+"&permission=billing.manage",
    "?studentProfileId="+student+"&centerId="+center+"&tenantId=any"])
  {
    const invalid=url(suffix);
    assert.throws(()=>readQueryResource(route,invalid),RangeError,suffix);
    assert.throws(()=>readCorePath(route,invalid),RangeError,suffix);
  }
});

test("PAP-1871 query order is canonicalized and never forwarded as unscoped parent read",()=>{
  const reverse=url("?studentProfileId="+student+"&centerId="+center);
  assert.equal(readCorePath(route,reverse),route+query);
  assert.deepEqual(readQueryResource(route,reverse),{centerId:center});
  assert.notEqual(readCorePath(route,reverse).split("?")[0],"identity/parents");
});
