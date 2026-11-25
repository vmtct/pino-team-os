import test from "node:test";
import assert from "node:assert/strict";
import { decideHostBoundary } from "./host-boundary";
import { handleNativeRoleLifecycle, parseNativeRoleArchive, parseNativeRoleCreate, verifyNativeRoleLifecycleReadback, type HoRoleLifecycleEnv } from "./ho-role-lifecycle-facade";
const host="ho.staging.pinohouse.art", id="00000000-0000-7000-8000-000000000025";
const create="/api/ho/system/roles/create", archive="/api/ho/system/roles/"+id+"/archive";
const body={roleKey:"fixture-role",displayName:" Fixture ",description:null,permissionKeys:[]};
const expectedUpdatedAt="2026-11-25T01:00:00.000Z";
const req=(path=create,b:unknown=body,origin="https://"+host,hostname=host)=>new Request("https://"+hostname+path,{method:"POST",headers:{host:hostname,origin,"content-type":"application/json","idempotency-key":"fixture-create-key"},body:JSON.stringify(b)});
const env={APP_ENV:"staging"} as HoRoleLifecycleEnv;
test("PAP-2373 exact native lifecycle admission",()=>{
  for(const path of [create,archive]){
    assert.deepEqual(decideHostBoundary(host,path,"POST"),{action:"next"});
    for(const method of ["GET","HEAD","PATCH","PUT","DELETE"])assert.deepEqual(decideHostBoundary(host,path,method),{action:"not_found"});
    for(const other of ["bo.staging.pinohouse.art","ho.pinohouse.art","tos.staging.pinohouse.art"])assert.deepEqual(decideHostBoundary(other,path,"POST"),{action:"not_found"});
  }
  for(const path of [archive.replace(id,"wrong"),archive.replace(id,"00000000-0000-4000-8000-000000000025"),create+"/extra","/api/bo/access/roles/"+id+"/archive"])assert.deepEqual(decideHostBoundary(host,path,"POST"),{action:"not_found"});
});
test("PAP-2373 strict identity and archive payload",()=>{
  assert.deepEqual(parseNativeRoleCreate(body),{...body,displayName:"Fixture"});
  for(const invalid of [null,{...body,permissionKeys:["access.role.view"]},{...body,roleType:"system"},{...body,roleKey:"founder"},{...body,description:12},{...body,displayName:" "},{...body,roleKey:"bad key"}])assert.equal(parseNativeRoleCreate(invalid),null);
  assert.deepEqual(parseNativeRoleArchive({expectedUpdatedAt}),{expectedUpdatedAt});
  for(const invalid of [{expectedUpdatedAt:"invalid"},{expectedUpdatedAt,roleId:id},{}])assert.equal(parseNativeRoleArchive(invalid),null);
});
test("PAP-2373 facade rejects before Core call on invalid request",async()=>{
  assert.equal((await handleNativeRoleLifecycle(req(create,body,"https://evil.invalid"),env)).status,403);
  assert.equal((await handleNativeRoleLifecycle(req(create,{...body,permissionKeys:["access.role.view"]}),env)).status,400);
  assert.equal((await handleNativeRoleLifecycle(req(),{...env,APP_ENV:"production"})).status,404);
  assert.equal((await handleNativeRoleLifecycle(req(create,body,"https://bo.staging.pinohouse.art","bo.staging.pinohouse.art"),env)).status,404);
  assert.equal((await handleNativeRoleLifecycle(req(archive,{expectedUpdatedAt}),env,"wrong")).status,404);
  assert.ok([401,403,503].includes((await handleNativeRoleLifecycle(req(),env)).status));
});
test("PAP-2373 persisted lifecycle readback, never optimistic success",()=>{
  const command=parseNativeRoleCreate(body);
  if(!command)throw Error("fixture");
  const row={...command,id,roleType:"custom",status:"active",permissionCount:0,assignmentCount:0,updatedAt:expectedUpdatedAt};
  assert.equal(verifyNativeRoleLifecycleReadback(id,command,row),true);
  for(const invalid of [{...row,id:"wrong"},{...row,assignmentCount:1},{...row,permissionCount:1},{...row,status:"archived"},{...row,displayName:"changed"}])assert.equal(verifyNativeRoleLifecycleReadback(id,command,invalid),false);
  const persisted={...row,status:"archived",updatedAt:"2026-11-25T01:00:01.000Z"};
  assert.equal(verifyNativeRoleLifecycleReadback(id,{expectedUpdatedAt},persisted),true);
  assert.equal(verifyNativeRoleLifecycleReadback(id,{expectedUpdatedAt},{...persisted,updatedAt:expectedUpdatedAt}),false);
  assert.equal(verifyNativeRoleLifecycleReadback(id,{expectedUpdatedAt},{...persisted,assignmentCount:1}),false);
});
