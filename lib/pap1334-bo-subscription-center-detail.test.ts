/** PAP-1334 / PAP-1491 SPEC-UNLOCK — selected-Center BO Subscription detail BFF. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {decideHostBoundary} from "./host-boundary";
import {isOperationalReadPath,readQueryResource} from "./bo-read-handler";

const id="01a1d9ae-9940-7b00-8b80-000000014981";
const center="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const path=`subscriptions/${id}/center-detail`;
const url=(query:string)=>new URL(`https://bo.staging.pinohouse.art/api/bo/${path}${query}`);
const endpoint=`/api/bo/${path}`;

test("PAP-1334: exact BO Staging GET admitted, but no other host or method",()=>{
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",endpoint,"GET"),{action:"next"});
 for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art",
  "other.staging.pinohouse.art","evil.bo.staging.pinohouse.art"]){
  assert.deepEqual(decideHostBoundary(host,endpoint,"GET"),{action:"not_found"},host);
 }
 for(const method of ["HEAD","POST","PATCH","PUT","DELETE"]){
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",endpoint,method),{action:"not_found"},method);
 }
 for(const suffix of ["/","/history","/activate","-other"]){
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",endpoint+suffix,"GET"),{action:"not_found"},suffix);
 }
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",
  "/api/bo/subscriptions/not-uuid/center-detail","GET"),{action:"not_found"});
});
test("PAP-1334: BFF forwards only exact one selected Center to Core resource",()=>{
 assert.equal(isOperationalReadPath(path),true);
 assert.deepEqual(readQueryResource(path,url("?centerId="+center)),{centerId:center});
 for(const query of ["","?centerId=","?centerId=bad","?centerId="+center+"&centerId="+center,
  "?centerId="+center+"&userId=founder","?centerId="+center+"&pathId=other",
  "?centerId="+center+"&centerId="]){
  assert.throws(()=>readQueryResource(path,url(query)),RangeError,query);
 }
 assert.equal(isOperationalReadPath(path+"/revoke"),false);
});
test("PAP-1334: canonical scoped adapter never infers Center for legacy by-ID",()=>{
 const legacy=`subscriptions/${id}`;
 assert.equal(readQueryResource(legacy,url("?centerId="+center)),undefined);
});
