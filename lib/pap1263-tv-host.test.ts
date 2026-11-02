import assert from "node:assert/strict";
import {test} from "node:test";
import {decideHostBoundary} from "./host-boundary";
import {isBoStagingRouteAdmitted} from "../app/bo/architecture/bo-staging-route-policy";
const staging="bo.staging.pinohouse.art";
test("PAP-1263 /bo/tvs TDD admitted but unapproved standalone mesh and TV operator remain denied by staging policy",()=>{
 assert.equal(isBoStagingRouteAdmitted("/bo/tvs"),true);
 for(const path of ["/bo/pinoria-tv-mesh","/bo/pinoria-tv-operator","/bo/tvs/subpath"])
  assert.equal(isBoStagingRouteAdmitted(path),false);
 assert.deepEqual(decideHostBoundary(staging,"/bo/tvs","GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary(staging,"/bo/pinoria-tv-mesh","GET"),{action:"not_found"});
});
test("PAP-1263 exact Staging-only spatial BFF verbs stay closed across other hosts and methods",()=>{
 for(const part of ["head","versions","version","active","drafts","publish","revert"]){
  const path="/api/bo/pinoria/tv-config/spatial/"+part;
  const allowed=["head","versions","version","active"].includes(part)?"GET":"POST";
  assert.deepEqual(decideHostBoundary(staging,path,allowed),{action:"next"},part);
  for(const method of ["GET","POST","HEAD","PUT","DELETE","PATCH"].filter(m=>m!==allowed))
   assert.deepEqual(decideHostBoundary(staging,path,method),{action:"not_found"},part+":"+method);
  for(const host of ["bo.pinohouse.art","ho.staging.pinohouse.art","tos.staging.pinohouse.art"])
   assert.deepEqual(decideHostBoundary(host,path,allowed),{action:"not_found"},host+part);
  for(const extra of ["/extra","/","%2fextra"])
   assert.deepEqual(decideHostBoundary(staging,path+extra,allowed),{action:"not_found"},extra);
 }
});
