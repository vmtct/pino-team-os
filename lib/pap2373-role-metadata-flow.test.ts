import assert from "node:assert/strict";
import test from "node:test";
import {createRoleMetadataFlow} from "../app/ho/system/roles/role-metadata-flow";
const row={id:"01a17d3f-8697-7080-bdf1-33e939758059",roleKey:"custom-example",roleType:"custom",status:"active",
 displayName:"Old",description:null,permissionKeys:["access.role.view"],permissionCount:1,assignmentCount:0,
 updatedAt:"2026-11-24T10:00:00.000Z"};
const fresh={...row,displayName:"New",updatedAt:"2026-11-24T10:00:01.000Z"};
const signal=()=>new AbortController().signal;
test("metadata flow submits once against exact fresh identity, then independently verifies readback",async()=>{
 let reads=0,submits=0;
 const flow=createRoleMetadataFlow({read:async()=>++reads===1?row:fresh,submit:async command=>{
  submits++;assert.equal(command.roleId,row.id);assert.deepEqual(command.body.permissionKeys,row.permissionKeys);
  assert.equal(command.body.expectedUpdatedAt,row.updatedAt);return "accepted";
 }});
 assert.deepEqual(await flow(row.id,row.updatedAt,{name:"New"},signal()),{status:"saved",receipt:fresh});
 assert.deepEqual([reads,submits],[2,1]);
});
test("metadata flow blocks stale, protected and mismatched records before submission",async()=>{
 for(const [current,expected] of [[row,"stale"],[{...row,roleType:"system"},row.updatedAt],[{...row,id:"other"},row.updatedAt]] as const){
  let submits=0;
  const flow=createRoleMetadataFlow({read:async()=>current,submit:async()=>{submits++;return "accepted"}});
  assert.ok(["conflict","invalid"].includes((await flow(row.id,expected,{name:"New"},signal())).status));
  assert.equal(submits,0);
 }
});
test("uncertain result never retries; conflict and rejected responses do not claim success",async()=>{
 for(const mode of ["throw","stale-readback","conflict","rejected"] as const){
  let reads=0,submits=0;
  const flow=createRoleMetadataFlow({read:async()=>{reads++;return row},submit:async()=>{
   submits++;if(mode==="throw")throw Error("transport lost");
   return mode==="stale-readback"?"accepted":mode;
  }});
  const expected=mode==="conflict"?"conflict":mode==="rejected"?"unavailable":"uncertain";
  assert.equal((await flow(row.id,row.updatedAt,{name:"New"},signal())).status,expected);
  assert.equal(submits,1);assert.equal(reads,mode==="stale-readback"?2:1);
 }
});
test("same-record concurrent attempt is busy, aborted preflight never submits",async()=>{
 let release!:()=>void,reads=0,submits=0;
 const held=new Promise<void>(resolve=>{release=resolve});
 const flow=createRoleMetadataFlow({read:async()=>{if(++reads===1){await held;return row}return fresh},submit:async()=>{submits++;return "accepted"}});
 const first=flow(row.id,row.updatedAt,{name:"New"},signal());
 assert.equal((await flow(row.id,row.updatedAt,{name:"New"},signal())).status,"busy");
 release();assert.equal((await first).status,"saved");assert.equal(submits,1);
 const aborted=new AbortController();aborted.abort();
 assert.equal((await flow(row.id,row.updatedAt,{name:"New"},aborted.signal)).status,"unavailable");
 assert.equal(submits,1);
});
