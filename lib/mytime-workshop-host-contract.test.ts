import {test} from "node:test";
import {decideHostBoundary} from "./host-boundary";
import assert from "node:assert/strict";
import {workshopHostDecision as decide} from "./mytime-workshop-host-contract";
const ho="ho.staging.pinohouse.art",bo="bo.staging.pinohouse.art",h="/api/ho/learning/mytime-workshops",b="/api/bo/learning/mytime-workshops",id="01a03c6e-cc58-7d81-ac8e-123456789abc";
test("PAP-2164 exact Workshop routes, isolated hosts and methods",()=>{
 for(const [host,path,method] of [[ho,"/ho/mytime-workshops","GET"],[bo,"/bo/mytime-workshops","HEAD"],[ho,h,"POST"],[ho,h+"/"+id,"PATCH"],[ho,h+"/"+id+"/cancel","POST"],[ho,h+"/lookup/staff","GET"],[bo,b,"GET"],[bo,b+"/"+id+"/history","GET"]])assert.equal(decide(host!,path!,method!),"next");
 for(const [host,path,method] of [[ho,b,"GET"],[bo,h,"GET"],["bo.pinohouse.art",b,"GET"],["tos.staging.pinohouse.art",h,"GET"],[bo,b,"POST"],[bo,b+"/"+id,"PATCH"],[bo,b+"/lookup/staff","GET"],[ho,h+"/"+id+"/cancel","GET"],[ho,h+"/"+id,"DELETE"],[ho,h+"/unknown","GET"],[ho,h+"/lookup/staff/extra","GET"],[ho,h+"/","GET"],[ho,h.toUpperCase(),"GET"]])assert.equal(decide(host!,path!,method!),"not_found");
 assert.equal(decide(bo,"/api/bo/centers","GET"),null);
});
test("PAP-2164 mounted shared host boundary preserves World and Guest while isolating Workshop",()=>{
 assert.deepEqual(decideHostBoundary(ho,h+"/lookup/staff","GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary(bo,b+"?ignored=1","GET"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(bo,b,"GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary(bo,b+"/"+id,"PATCH"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(ho,h,"POST"),{action:"next"});
 assert.deepEqual(decideHostBoundary("ho.pinohouse.art",h,"GET"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(bo,h,"GET"),{action:"not_found"});
 assert.deepEqual(decideHostBoundary(bo,"/api/bo/identity/mytime-guests","GET"),{action:"next"});
 assert.deepEqual(decideHostBoundary(ho,"/api/ho/pinoria/worlds/"+id+"/history","GET"),{action:"next"});
});
