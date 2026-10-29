import test from "node:test";
import assert from "node:assert/strict";
import {isOperationalReadPath} from "./bo-read-handler";
import {isAllowedPostPath} from "./bo-write-handler";
import {decideHostBoundary} from "./host-boundary";

test("PAP-1092 BO BFF admits only one-use Pass inventory and write whitelist",()=>{
 assert.equal(isOperationalReadPath("open-studio/walkin/inventory"),true);
 assert.equal(isOperationalReadPath("open-studio/walkin/lookup"),false);
 assert.equal(isOperationalReadPath("open-studio/walkin/consume"),false);
 for(const p of ["batches","assign","revoke"]) assert.equal(isAllowedPostPath("open-studio/walkin/"+p),true,p);
 for(const p of ["consume","lookup","refund","delete","foo"])assert.equal(isAllowedPostPath("open-studio/walkin/"+p),false,p);
});
test("PAP-1092 BO endpoint cannot cross HO/TOS host boundary",()=>{
 for(const suffix of ["inventory","batches","assign","revoke"]){
  const path="/api/bo/open-studio/walkin/"+suffix;
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,suffix==="inventory"?"GET":"POST"),{action:"next"});
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,suffix==="inventory"?"GET":"POST"),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("tos.staging.pinohouse.art",path,suffix==="inventory"?"GET":"POST"),{action:"not_found"});
 }
});
test("PAP-1092 TOS binding is not routed via BO BFF",()=>{
 assert.deepEqual(decideHostBoundary("tos.staging.pinohouse.art","/api/tos-learning/open-studio/walkin/lookup","GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary("tos.staging.pinohouse.art","/api/tos-learning/open-studio/walkin/consume","POST"),{action:"next"});
});

test("PAP-1092 HO Open Studio Pass host route is isolated and verb-limited",()=>{
 for(const [route,method] of [["inventory","GET"],["batches","POST"],["revoke","POST"]] as const){
  const path="/api/ho/open-studio/walkin/"+route;
  assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art",path,method),{action:"next"});
  assert.deepEqual(decideHostBoundary("bo.staging.pinohouse.art",path,method),{action:"not_found"});
  assert.deepEqual(decideHostBoundary("tos.staging.pinohouse.art",path,method),{action:"not_found"});
 }
 assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art","/api/ho/open-studio/walkin/assign","POST"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary("ho.staging.pinohouse.art","/api/ho/open-studio/walkin/batches","GET"),{action:"not_found"});
});