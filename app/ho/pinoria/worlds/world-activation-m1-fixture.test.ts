import test from "node:test";
import assert from "node:assert/strict";
import {createWorldActivationFixture,WORLD_M1_ID} from "./world-activation-m1-fixture";
import {activateWorld,fetchWorldCatalog,fetchWorldHistory} from "./world-runtime-client";
test("PAP-2143 isolated M1 activation uses native client and persisted-in-memory readback",async()=>{
 const transport=createWorldActivationFixture();
 const [w]=await fetchWorldCatalog(transport);
 assert.equal(w!.id,WORLD_M1_ID);assert.equal(w!.status,"DRAFT");
 const active=await activateWorld(w!,transport);
 assert.equal(active.status,"ACTIVE");assert.equal(active.version,2);
 assert.equal((await fetchWorldHistory(WORLD_M1_ID,transport)).events.length,2);
 await assert.rejects(()=>activateWorld(w!,transport));
 assert.equal((await fetchWorldCatalog(createWorldActivationFixture()))[0]!.status,"DRAFT");
});
test("PAP-2143 M1 fixture refuses external and nonactivation commands and ineligible activation",async()=>{
 for(const config of [{canManage:false},{hasScene:false}]){
  const transport=createWorldActivationFixture(config),[w]=await fetchWorldCatalog(transport);
  await assert.rejects(()=>activateWorld(w!,transport));
  assert.equal((await fetchWorldCatalog(transport))[0]!.status,"DRAFT");
 }
 const transport=createWorldActivationFixture();
 for(const [url,method] of [["https://ho.staging.pinohouse.art/api/ho/pinoria/worlds","GET"],["/api/ho/pinoria/worlds","POST"],["/api/ho/pinoria/worlds/"+WORLD_M1_ID,"DELETE"]]){
  assert.equal((await transport(url!,{method})).status,404);
 }
 const url="/api/ho/pinoria/worlds/"+WORLD_M1_ID;
 for(const body of [{expectedVersion:1,status:"ARCHIVED"},{expectedVersion:1,status:"ACTIVE",displayName:"overpost"}])assert.equal((await transport(url,{method:"PATCH",body:JSON.stringify(body)})).status,400);
 assert.equal((await transport(url,{method:"PATCH",body:JSON.stringify({expectedVersion:2,status:"ACTIVE"})})).status,409);
 assert.equal((await fetchWorldHistory(WORLD_M1_ID,transport)).events.length,1);
});
