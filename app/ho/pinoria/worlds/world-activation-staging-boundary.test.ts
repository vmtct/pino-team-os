import test from "node:test";
import assert from "node:assert/strict";
import {createWorldStagingBoundary,readWorldStagingRef,worldStagingRef} from "./world-activation-staging-boundary";
import {WORLD_M1_ID,WORLD_M1_ROUTE} from "./world-activation-m1-fixture";
import {activateWorld,fetchWorldCatalog,fetchWorldHistory} from "./world-runtime-client";
const base="https://ho.staging.pinohouse.art"+WORLD_M1_ROUTE;
test("PAP-2143 staging fixture route only exact host/path and pinned record/detail tab",()=>{
 assert.deepEqual(readWorldStagingRef(new URL(base)),{id:null,tab:null});
 for(const tab of [undefined,"overview","scenes","preview","history"]){
  const path=worldStagingRef(WORLD_M1_ID,tab);
  assert.deepEqual(readWorldStagingRef(new URL(path,base)),{id:WORLD_M1_ID,tab:tab??null});
 }
 for(const url of [base+"?record=other",base+"?record="+WORLD_M1_ID,base+"?surface=detail",base+"?record=WORLD-MOCK-001&tab=overview",base+"?record=WORLD-MOCK-001&surface=detail&tab=access",base+"?record=WORLD-MOCK-001&record=WORLD-MOCK-001",base+"?m1Preview=1",base+"#hash",base+"/extra",base.replace("https:","http:"),base.replace("ho.staging","ho")])assert.throws(()=>readWorldStagingRef(new URL(url)));
 assert.throws(()=>worldStagingRef("other"));assert.throws(()=>worldStagingRef(null,"overview"));
});
test("PAP-2143 staging M1 mock transport isolates sessions and denies unauthorized activation",async()=>{
 const a=createWorldStagingBoundary(true),b=createWorldStagingBoundary(false);
 const [w]=await fetchWorldCatalog(a.transport);
 assert.equal((await activateWorld(w!,a.transport)).status,"ACTIVE");
 assert.equal((await fetchWorldHistory(WORLD_M1_ID,a.transport)).events.length,2);
 const [denied]=await fetchWorldCatalog(b.transport);
 await assert.rejects(()=>activateWorld(denied!,b.transport));
 assert.equal((await fetchWorldCatalog(b.transport))[0]!.status,"DRAFT");
 assert.equal((await fetchWorldCatalog(createWorldStagingBoundary(true).transport))[0]!.status,"DRAFT");
});
