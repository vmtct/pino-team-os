/** PAP-1334 / PAP-1491 SPEC-UNLOCK — immutable Subscription owning-Center BO BFF. */
import assert from "node:assert/strict";
import {test} from "node:test";
import {decideHostBoundary} from "./host-boundary";
import {isOperationalReadPath,readQueryBody,readQueryResource} from "./bo-read-handler";

const id="01a0b29a-3acd-7a18-a0f2-cf6016548ab5";
const path="subscriptions/center-directory";
const endpoint="/api/bo/"+path;
const url=(query:string)=>new URL("https://bo.staging.pinohouse.art"+endpoint+query);
const bad=(query:string)=>{
 assert.throws(()=>readQueryBody(path,url(query)),RangeError,"body "+query);
};

test("PAP-1334 owner Directory admitted on exact BO Staging GET, never Production, HO, TOS or writers",()=>{
 assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",endpoint,"GET"),{action:"next"});
 for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art",
  "bo.staging.pinohouse.art.evil.example","other.staging.pinohouse.art"]){
  assert.deepEqual(decideHostBoundary(host,endpoint,"GET"),{action:"not_found"},host);
 }
 for(const method of ["HEAD","POST","PATCH","PUT","DELETE"]){
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",endpoint,method),{action:"not_found"},method);
 }
 for(const suffix of ["/","/history","/sale","-fake","/activate"]){
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",endpoint+suffix,"GET"),{action:"not_found"},suffix);
 }
});

test("PAP-1334 Owner Directory forwards exactly one effective selected Center selector and bounded filters",()=>{
 assert.equal(isOperationalReadPath(path),true);
 assert.deepEqual(readQueryResource(path,url("?centerId="+id)),{centerId:id});
 assert.deepEqual(readQueryBody(path,url("?centerId="+id)),{centerId:id});
 const chosen="?centerId="+id+"&lifecycle=ACTIVE&query=Alice&limit=50";
 assert.deepEqual(readQueryBody(path,url(chosen)),{centerId:id,lifecycle:"ACTIVE",query:"Alice",limit:50});
 const cursor="?centerId="+id+"&beforeCreatedAt=2026-11-11T01%3A02%3A03.000Z&beforeSubscriptionId="+id;
 assert.deepEqual(readQueryBody(path,url(cursor)),{
  centerId:id,beforeCreatedAt:"2026-11-11T01:02:03.000Z",beforeSubscriptionId:id,
 });
});

test("PAP-1334 Owner Directory denies missing/ambiguous/forged Center, unknown filters and bad cursors",()=>{
 for(const query of ["","?centerId=","?centerId=bad","?centerId="+id+"&centerId="+id,
  "?centerId="+id+"&userId=founder","?centerId="+id+"&scope=GLOBAL",
  "?centerId="+id+"&limit=0","?centerId="+id+"&limit=101","?centerId="+id+"&limit=1.5",
  "?centerId="+id+"&query="+encodeURIComponent("a".repeat(121)),
  "?centerId="+id+"&lifecycle=FAKE","?centerId="+id+"&pathProgramId=FAKE",
  "?centerId="+id+"&beforeCreatedAt=2026-11-11T00:00:00Z",
  "?centerId="+id+"&beforeSubscriptionId="+id,
  "?centerId="+id+"&beforeCreatedAt=bad&beforeSubscriptionId="+id,
  "?centerId="+id+"&beforeCreatedAt=2026-11-11T00:00:00Z&beforeSubscriptionId=bad"]){
  bad(query);
 }
 for(const query of ["","?centerId=bad","?centerId="+id+"&centerId="+id]){
  assert.throws(()=>readQueryResource(path,url(query)),RangeError,query);
 }
});

test("PAP-1334 Owner Directory does not rebind legacy Subscription reader to a fake Center",()=>{
 assert.equal(readQueryResource("subscriptions",url("?centerId="+id)),undefined);
 assert.equal(isOperationalReadPath("subscriptions/center-directory/revoke"),false);
});
